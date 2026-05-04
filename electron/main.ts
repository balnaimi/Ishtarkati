import { app, BrowserWindow, ipcMain, Notification, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
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
