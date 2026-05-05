import { app, dialog, ipcMain, BrowserWindow } from "electron";
import fs from "node:fs";
import type Database from "better-sqlite3";

export const BACKUP_EXPORT_VERSION = 4;

interface BackupPayload {
  exportVersion: number;
  exportedAt: string;
  appVersion: string;
  categories: unknown[];
  subscriptions: unknown[];
  payment_events: unknown[];
  settings: unknown[];
  currencies: unknown[];
  credit_cards: unknown[];
  wallet_methods: unknown[];
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function validatePayload(raw: unknown): BackupPayload {
  if (!isRecord(raw)) throw new Error("Invalid backup file");
  const exportVersion = raw.exportVersion;
  if (
    exportVersion !== 1 &&
    exportVersion !== 2 &&
    exportVersion !== 3 &&
    exportVersion !== 4
  ) {
    throw new Error(`Unsupported backup version: ${String(exportVersion)}`);
  }
  const categories = raw.categories;
  const subscriptions = raw.subscriptions;
  const payment_events = raw.payment_events;
  const settings = raw.settings;
  const currencies = Array.isArray(raw.currencies) ? raw.currencies : [];
  const credit_cards = Array.isArray(raw.credit_cards) ? raw.credit_cards : [];
  const wallet_methods = Array.isArray(raw.wallet_methods) ? raw.wallet_methods : [];
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
    credit_cards,
    wallet_methods,
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
    database.prepare("DELETE FROM wallet_methods").run();
    database.prepare("DELETE FROM credit_cards").run();
    database.prepare("DELETE FROM categories").run();
    database.prepare("DELETE FROM currencies").run();
    database.prepare("DELETE FROM settings").run();

    const insCard = database.prepare(`
      INSERT INTO credit_cards (id, brand, last4, exp_month, exp_year, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.credit_cards) {
      if (!isRecord(row)) throw new Error("Invalid credit card row");
      insCard.run(
        row.id,
        row.brand,
        row.last4,
        row.exp_month,
        row.exp_year,
        row.created_at,
        row.updated_at,
      );
    }

    const insWallet = database.prepare(`
      INSERT INTO wallet_methods (id, service_code, account_text, linked_card_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.wallet_methods) {
      if (!isRecord(row)) throw new Error("Invalid wallet row");
      insWallet.run(
        row.id,
        row.service_code,
        row.account_text,
        row.linked_card_id ?? null,
        row.created_at,
        row.updated_at,
      );
    }

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
        interval_count, auto_renew, amount_original, currency_code, amount_qar_snapshot, fx_rate_used, fx_quote_at,
        start_date, next_due_date, end_date, is_domain, tags, credit_card_id, wallet_method_id,
        created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const row of data.subscriptions) {
      if (!isRecord(row)) throw new Error("Invalid subscription row");
      const tags =
        "tags" in row && row.tags != null && String(row.tags).length > 0
          ? String(row.tags)
          : null;
      let billing_model = String(row.billing_model ?? "one_time");
      if (billing_model === "pay_as_needed") billing_model = "one_time";
      const interval_count =
        "interval_count" in row && row.interval_count != null
          ? Number(row.interval_count)
          : 1;
      insSub.run(
        row.id,
        row.title,
        row.notes ?? null,
        row.website_url ?? null,
        row.category_id ?? null,
        billing_model,
        row.interval_unit ?? null,
        row.interval_months ?? null,
        interval_count,
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
        tags,
        "credit_card_id" in row ? (row.credit_card_id ?? null) : null,
        "wallet_method_id" in row ? (row.wallet_method_id ?? null) : null,
        row.created_at,
        row.updated_at,
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
    resetAutoincrement(database, "credit_cards");
    resetAutoincrement(database, "wallet_methods");
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
    const credit_cards = database.prepare("SELECT * FROM credit_cards ORDER BY id").all();
    const wallet_methods = database.prepare("SELECT * FROM wallet_methods ORDER BY id").all();

    const payload: BackupPayload = {
      exportVersion: BACKUP_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      categories,
      subscriptions,
      payment_events,
      settings,
      currencies,
      credit_cards,
      wallet_methods,
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
