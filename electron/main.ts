import { app, BrowserWindow, ipcMain, Menu, Notification, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { SCHEMA_V1_STATEMENTS } from "./schema";
import { registerBackupIpc } from "./backup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;
let db: Database.Database | null = null;

/** Map Tauri-style $1 placeholders to better-sqlite3 `?` (same arg order). */
function normalizeSql(sql: string): string {
  return sql.replace(/\$(\d+)/g, "?");
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );
  `);
  const row = database
    .prepare("SELECT version FROM schema_version LIMIT 1")
    .get() as { version: number } | undefined;
  let version = row?.version;
  if (version == null) {
    database.prepare("INSERT INTO schema_version (version) VALUES (0)").run();
    version = 0;
  }
  if (version < 1) {
    for (const stmt of SCHEMA_V1_STATEMENTS) {
      database.exec(stmt);
    }
    database.prepare("UPDATE schema_version SET version = 1").run();
    version = 1;
  }
  if (version < 2) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS currencies (
        code TEXT PRIMARY KEY COLLATE NOCASE,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    `);
    database.prepare("UPDATE schema_version SET version = 2").run();
  }
  if (version < 3) {
    database.exec("ALTER TABLE subscriptions ADD COLUMN tags TEXT");
    database.prepare("UPDATE schema_version SET version = 3").run();
  }
  if (version < 4) {
    database.exec("PRAGMA foreign_keys = OFF");
    const migrate = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS credit_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT NOT NULL,
        last4 TEXT NOT NULL,
        exp_month INTEGER NOT NULL,
        exp_year INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wallet_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_code TEXT NOT NULL,
        account_text TEXT NOT NULL,
        linked_card_id INTEGER REFERENCES credit_cards(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    database.exec(`ALTER TABLE subscriptions RENAME TO subscriptions_legacy_v4`);
    database.exec(`
      CREATE TABLE subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        notes TEXT,
        website_url TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        billing_model TEXT NOT NULL CHECK (billing_model IN ('one_time', 'recurring')),
        interval_unit TEXT,
        interval_months INTEGER,
        interval_count INTEGER NOT NULL DEFAULT 1,
        auto_renew INTEGER NOT NULL DEFAULT 0,
        amount_original REAL NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'USD',
        amount_qar_snapshot REAL,
        fx_rate_used REAL,
        fx_quote_at TEXT,
        start_date TEXT,
        next_due_date TEXT,
        end_date TEXT,
        is_domain INTEGER NOT NULL DEFAULT 0,
        tags TEXT,
        credit_card_id INTEGER REFERENCES credit_cards(id) ON DELETE SET NULL,
        wallet_method_id INTEGER REFERENCES wallet_methods(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_subs_category ON subscriptions(category_id);
      CREATE INDEX IF NOT EXISTS idx_subs_next_due ON subscriptions(next_due_date);
    `);
    type LegacySub = {
      id: number;
      title: string;
      notes: string | null;
      website_url: string | null;
      category_id: number | null;
      billing_model: string;
      interval_unit: string | null;
      interval_months: number | null;
      auto_renew: number;
      amount_original: number;
      currency_code: string;
      amount_qar_snapshot: number | null;
      fx_rate_used: number | null;
      fx_quote_at: string | null;
      start_date: string | null;
      next_due_date: string | null;
      end_date: string | null;
      is_domain: number;
      tags: string | null;
      created_at: string;
      updated_at: string;
    };
    const legacyRows = database
      .prepare("SELECT * FROM subscriptions_legacy_v4")
      .all() as LegacySub[];
    const ins = database.prepare(`
      INSERT INTO subscriptions (
        id, title, notes, website_url, category_id, billing_model, interval_unit, interval_months,
        interval_count, auto_renew, amount_original, currency_code, amount_qar_snapshot, fx_rate_used,
        fx_quote_at, start_date, next_due_date, end_date, is_domain, tags, credit_card_id,
        wallet_method_id, created_at, updated_at
      ) VALUES (
        @id, @title, @notes, @website_url, @category_id, @billing_model, @interval_unit, @interval_months,
        @interval_count, @auto_renew, @amount_original, @currency_code, @amount_qar_snapshot, @fx_rate_used,
        @fx_quote_at, @start_date, @next_due_date, @end_date, @is_domain, @tags, @credit_card_id,
        @wallet_method_id, @created_at, @updated_at
      )
    `);
    for (const r of legacyRows) {
      let billing_model: string =
        r.billing_model === "pay_as_needed" ? "one_time" : r.billing_model;
      if (billing_model !== "recurring" && billing_model !== "one_time") {
        billing_model = "one_time";
      }
      let interval_unit = r.interval_unit ?? null;
      let interval_months: number | null = r.interval_months;
      let interval_count = 1;
      if (billing_model === "recurring") {
        let u = interval_unit ?? "month";
        if (u === "quarter") {
          u = "month";
          interval_count = 3;
          interval_months = null;
        } else if (u === "custom_months") {
          u = "month";
          interval_count = Math.max(1, r.interval_months ?? 1);
          interval_months = null;
        } else if (u === "month" || u === "year") {
          interval_count = 1;
        } else if (u === "day" || u === "week") {
          interval_count = Math.max(1, r.interval_months ?? 1);
          interval_months = null;
        } else {
          u = "month";
          interval_count = 1;
          interval_months = null;
        }
        interval_unit = u;
      } else {
        interval_unit = null;
        interval_months = null;
        interval_count = 1;
      }
      ins.run({
        id: r.id,
        title: r.title,
        notes: r.notes,
        website_url: r.website_url,
        category_id: r.category_id,
        billing_model,
        interval_unit,
        interval_months,
        interval_count,
        auto_renew: r.auto_renew,
        amount_original: r.amount_original,
        currency_code: r.currency_code,
        amount_qar_snapshot: r.amount_qar_snapshot,
        fx_rate_used: r.fx_rate_used,
        fx_quote_at: r.fx_quote_at,
        start_date: r.start_date,
        next_due_date: r.next_due_date,
        end_date: r.end_date,
        is_domain: r.is_domain,
        tags: r.tags,
        credit_card_id: null,
        wallet_method_id: null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      });
    }
    database.exec("DROP TABLE subscriptions_legacy_v4");
    const maxRow = database.prepare("SELECT MAX(id) AS m FROM subscriptions").get() as {
      m: number | null;
    };
    const maxId = maxRow.m ?? 0;
    database.prepare("DELETE FROM sqlite_sequence WHERE name = 'subscriptions'").run();
    if (maxId > 0) {
      database.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('subscriptions', ?)").run(
        maxId,
      );
    }
    database.prepare("UPDATE schema_version SET version = 4").run();
    });
    migrate();
    database.exec("PRAGMA foreign_keys = ON");
  }
  if (version < 5) {
    const subN =
      (database.prepare("SELECT COUNT(*) AS n FROM subscriptions").get() as { n: number }).n ?? 0;
    const wallN =
      (database.prepare("SELECT COUNT(*) AS n FROM wallet_methods").get() as { n: number }).n ?? 0;
    const primRow = database
      .prepare("SELECT value FROM settings WHERE key = 'primary_currency' LIMIT 1")
      .get() as { value: string } | undefined;
    const hasPrim = (primRow?.value?.trim().length ?? 0) >= 3;
    if (subN > 0 || wallN > 0 || hasPrim) {
      dbSetSetting(database, "onboarding_complete", "1");
    }
    database.prepare("UPDATE schema_version SET version = 5").run();
  }
}

const PIN_SALT_KEY = "app_pin_salt";
const PIN_HASH_KEY = "app_pin_hash";

function dbGetSetting(database: Database.Database, key: string): string | null {
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function dbSetSetting(database: Database.Database, key: string, value: string): void {
  database
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

function dbDelSetting(database: Database.Database, key: string): void {
  database.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

function hashPin(pin: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPinScrypt(pin: string, saltHex: string, hashHex: string): boolean {
  try {
    const got = crypto.scryptSync(pin, saltHex, 64).toString("hex");
    const a = Buffer.from(got, "hex");
    const b = Buffer.from(hashHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function openDatabase(): void {
  const dir = app.getPath("userData");
  const fp = path.join(dir, "ishtarkati.db");
  db = new Database(fp);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
}

function registerIpc(): void {
  ipcMain.handle(
    "db:select",
    (_evt, sql: string, params: unknown[]) => {
      if (!db) throw new Error("Database not ready");
      const stmt = db.prepare(normalizeSql(sql));
      return stmt.all(...params);
    },
  );
  ipcMain.handle(
    "db:execute",
    (_evt, sql: string, params: unknown[]) => {
      if (!db) throw new Error("Database not ready");
      const stmt = db.prepare(normalizeSql(sql));
      const info = stmt.run(...params);
      return {
        changes: info.changes,
        lastInsertRowid: Number(info.lastInsertRowid),
      };
    },
  );
  ipcMain.handle("shell:openExternal", (_evt, url: string) => {
    return shell.openExternal(url);
  });

  ipcMain.handle(
    "notification:show",
    (_evt, opts: { title: string; body: string }) => {
      if (!Notification.isSupported()) return false;
      new Notification({ title: opts.title, body: opts.body }).show();
      return true;
    },
  );

  ipcMain.handle("security:pinStatus", () => {
    if (!db) return { enabled: false, hasPin: false };
    const enabled = dbGetSetting(db, "pin_enabled") === "1";
    const hasPin = Boolean(dbGetSetting(db, PIN_HASH_KEY));
    return { enabled, hasPin };
  });

  ipcMain.handle("security:setPin", (_evt, pin: string) => {
    if (!db || typeof pin !== "string" || pin.length < 4) {
      return { ok: false as const, error: "bad_pin" };
    }
    const { salt, hash } = hashPin(pin);
    dbSetSetting(db, PIN_SALT_KEY, salt);
    dbSetSetting(db, PIN_HASH_KEY, hash);
    dbSetSetting(db, "pin_enabled", "1");
    return { ok: true as const };
  });

  ipcMain.handle("security:clearPin", () => {
    if (!db) return { ok: false as const };
    dbDelSetting(db, PIN_SALT_KEY);
    dbDelSetting(db, PIN_HASH_KEY);
    dbSetSetting(db, "pin_enabled", "0");
    return { ok: true as const };
  });

  ipcMain.handle("security:verifyPin", (_evt, pin: string) => {
    if (!db || typeof pin !== "string") return false;
    const salt = dbGetSetting(db, PIN_SALT_KEY);
    const hash = dbGetSetting(db, PIN_HASH_KEY);
    if (!salt || !hash) return false;
    return verifyPinScrypt(pin, salt, hash);
  });

  registerBackupIpc(
    () => db,
    () => win,
  );
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    win?.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("context-menu", (_event, params) => {
    const template: Electron.MenuItemConstructorOptions[] = [];
    if (params.isEditable) {
      template.push(
        { role: "cut", label: "قص" },
        { role: "copy", label: "نسخ" },
        { role: "paste", label: "لصق" },
        { type: "separator" },
        { role: "selectAll", label: "تحديد الكل" },
      );
    } else if (params.selectionText?.trim()) {
      template.push({ role: "copy", label: "نسخ" });
    }
    if (template.length === 0) return;
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win! });
  });

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    db?.close();
    db = null;
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  openDatabase();
  registerIpc();
  createWindow();
});
