import { app, dialog, ipcMain, BrowserWindow } from "electron";
import fs from "node:fs";
import type Database from "better-sqlite3";

export const BACKUP_EXPORT_VERSION = 3;

interface BackupPayload {
  exportVersion: number;
  exportedAt: string;
  appVersion: string;
  categories: unknown[];
  subscriptions: unknown[];
  payment_events: unknown[];
  settings: unknown[];
  currencies: unknown[];
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function validatePayload(raw: unknown): BackupPayload {
  if (!isRecord(raw)) throw new Error("Invalid backup file");
  const exportVersion = raw.exportVersion;
  if (exportVersion !== 1 && exportVersion !== 2 && exportVersion !== 3) {
    throw new Error(`Unsupported backup version: ${String(exportVersion)}`);
  }
  const categories = raw.categories;
  const subscriptions = raw.subscriptions;
  const payment_events = raw.payment_events;
  const settings = raw.settings;
  const currencies = Array.isArray(raw.currencies) ? raw.currencies : [];
  if (!Array.isArray(categories)) throw new Error("Invalid backup: categories");
  if (!Array.isArray(subscriptions)) throw new Error("Invalid backup: subscriptions");
  if (!Array.isArray(payment_events)) throw new Error("Invalid backup: payment_events");
  if (!Array.isArray(settings)) throw new Error("Invalid backup: settings");
  return {
    exportVersion,
    exportedAt: String(raw.exportedAt ?? ""),
    appVersion: String(raw.appVersion ?? ""),
    categories,
    subscriptions,
    payment_events,
    settings,
    currencies,
  };
}

function resetAutoincrement(database: Database.Database, table: string): void {
  const row = database.prepare(`SELECT MAX(id) AS m FROM ${table}`).get() as {
    m: number | null;
  };
  const m = row.m ?? 0;
  database.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
  if (m > 0) {
    database.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)").run(
      table,
      m,
    );
  }
}

function importIntoDb(database: Database.Database, data: BackupPayload): void {
  const tx = database.transaction(() => {
    database.prepare("DELETE FROM payment_events").run();
    database.prepare("DELETE FROM subscriptions").run();
    database.prepare("DELETE FROM categories").run();
    database.prepare("DELETE FROM currencies").run();
    database.prepare("DELETE FROM settings").run();

    const insCur = database.prepare(
      "INSERT INTO currencies (code, sort_order) VALUES (?, ?)",
    );
    for (const row of data.currencies) {
      if (!isRecord(row)) throw new Error("Invalid currency row");
      insCur.run(String(row.code).trim().toUpperCase(), Number(row.sort_order) || 0);
    }

    const insCat = database.prepare(
      "INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)",
    );
    for (const row of data.categories) {
      if (!isRecord(row)) throw new Error("Invalid category row");
      insCat.run(row.id, row.name, row.sort_order);
    }

    const insSub = database.prepare(`
      INSERT INTO subscriptions (
        id, title, notes, website_url, category_id, billing_model, interval_unit, interval_months,
        auto_renew, amount_original, currency_code, amount_qar_snapshot, fx_rate_used, fx_quote_at,
        start_date, next_due_date, end_date, is_domain, created_at, updated_at, tags
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const row of data.subscriptions) {
      if (!isRecord(row)) throw new Error("Invalid subscription row");
      const tags =
        "tags" in row && row.tags != null && String(row.tags).length > 0
          ? String(row.tags)
          : null;
      insSub.run(
        row.id,
        row.title,
        row.notes ?? null,
        row.website_url ?? null,
        row.category_id ?? null,
        row.billing_model,
        row.interval_unit ?? null,
        row.interval_months ?? null,
        row.auto_renew,
        row.amount_original,
        row.currency_code,
        row.amount_qar_snapshot ?? null,
        row.fx_rate_used ?? null,
        row.fx_quote_at ?? null,
        row.start_date ?? null,
        row.next_due_date ?? null,
        row.end_date ?? null,
        row.is_domain,
        row.created_at,
        row.updated_at,
        tags,
      );
    }

    const insPay = database.prepare(`
      INSERT INTO payment_events (
        id, subscription_id, paid_at, amount_original, currency, amount_qar, renewal_years, note
      ) VALUES (?,?,?,?,?,?,?,?)
    `);
    for (const row of data.payment_events) {
      if (!isRecord(row)) throw new Error("Invalid payment row");
      insPay.run(
        row.id,
        row.subscription_id,
        row.paid_at,
        row.amount_original ?? null,
        row.currency ?? null,
        row.amount_qar ?? null,
        row.renewal_years ?? null,
        row.note ?? null,
      );
    }

    const insSet = database.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?)",
    );
    for (const row of data.settings) {
      if (!isRecord(row)) throw new Error("Invalid settings row");
      insSet.run(row.key, row.value);
    }

    resetAutoincrement(database, "categories");
    resetAutoincrement(database, "subscriptions");
    resetAutoincrement(database, "payment_events");
  });
  tx();
}

export function registerBackupIpc(
  getDb: () => Database.Database | null,
  getWin: () => BrowserWindow | null,
): void {
  ipcMain.handle("backup:export", async () => {
    const database = getDb();
    const w = getWin();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!w) return { ok: false as const, error: "no-window" };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const { filePath, canceled } = await dialog.showSaveDialog(w, {
      title: "تصدير نسخة إشتراكاتي",
      defaultPath: `ishtarkati-backup-${stamp}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { ok: false as const, canceled: true };

    const categories = database.prepare("SELECT * FROM categories ORDER BY id").all();
    const subscriptions = database
      .prepare("SELECT * FROM subscriptions ORDER BY id")
      .all();
    const payment_events = database
      .prepare("SELECT * FROM payment_events ORDER BY id")
      .all();
    const settings = database.prepare("SELECT * FROM settings ORDER BY key").all();
    const currencies = database.prepare("SELECT * FROM currencies ORDER BY sort_order, code").all();

    const payload: BackupPayload = {
      exportVersion: BACKUP_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      categories,
      subscriptions,
      payment_events,
      settings,
      currencies,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    return { ok: true as const, path: filePath };
  });

  ipcMain.handle("backup:import", async () => {
    const database = getDb();
    const w = getWin();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!w) return { ok: false as const, error: "no-window" };

    const { filePaths, canceled } = await dialog.showOpenDialog(w, {
      title: "استيراد نسخة",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePaths?.[0]) return { ok: false as const, canceled: true };

    try {
      const raw = fs.readFileSync(filePaths[0], "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const data = validatePayload(parsed);
      importIntoDb(database, data);
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });
}
