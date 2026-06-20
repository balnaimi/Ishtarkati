import { app, BrowserWindow, Menu, Notification, Tray, dialog, nativeImage, type OpenDialogOptions } from "electron";
import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { runAutoBackupIfDue, runManualAutoBackup } from "./autoBackup";
import { isAutoBackupBusy } from "./autoBackupStatus";
import { readUiLocale } from "./uiLocale";
import localeAr from "../src/locales/ar.json";
import localeEn from "../src/locales/en.json";

let tray: Tray | null = null;
let backgroundTimer: ReturnType<typeof setInterval> | null = null;
let appQuitting = false;

const REMINDER_SENT_PREFIX = "bg_reminder_";
const DUE_TODAY_SENT_PREFIX = "bg_due_today_";
export const CLOSE_ACTION_KEY = "close_action";

export type StoredCloseAction = "ask" | "tray" | "quit";

export function markAppQuitting(): void {
  appQuitting = true;
}

export function isAppQuitting(): boolean {
  return appQuitting;
}

function trayStrings(database: Database.Database | null) {
  const loc = readUiLocale(database);
  return loc === "en" ? localeEn.tray : localeAr.tray;
}

function notifyStrings(database: Database.Database | null) {
  const loc = readUiLocale(database);
  return loc === "en" ? localeEn.notify : localeAr.notify;
}

function dbGetSetting(database: Database.Database, key: string): string | null {
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function dbSetSetting(database: Database.Database, key: string, value: string): void {
  database
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

function loadTrayIcon(iconPath: string | undefined): Electron.NativeImage {
  if (iconPath && fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img.resize({ width: 22, height: 22 });
  }
  return nativeImage.createEmpty();
}

function closeChoiceStrings(database: Database.Database | null) {
  const loc = readUiLocale(database);
  return loc === "en" ? localeEn.closeChoice : localeAr.closeChoice;
}

function readStoredCloseAction(database: Database.Database | null): StoredCloseAction {
  if (!database) return "ask";
  const raw = dbGetSetting(database, CLOSE_ACTION_KEY);
  if (raw === "tray" || raw === "quit") return raw;
  return "ask";
}

async function promptNativeCloseChoice(
  win: BrowserWindow,
  database: Database.Database | null,
): Promise<void> {
  const t = closeChoiceStrings(database);
  const { response } = await dialog.showMessageBox(win, {
    type: "question",
    title: t.title,
    message: t.message,
    buttons: [t.background, t.quit, t.cancel],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  if (response === 0) win.hide();
  else if (response === 1) {
    if (isAutoBackupBusy()) return;
    markAppQuitting();
    app.quit();
  }
}

export function applyCloseAction(
  win: BrowserWindow,
  action: StoredCloseAction | "tray" | "quit",
): void {
  if (action === "tray") {
    win.hide();
    return;
  }
  markAppQuitting();
  app.quit();
}

export function installWindowCloseHandler(
  win: BrowserWindow,
  getDb: () => Database.Database | null,
): void {
  win.on("close", (e) => {
    if (appQuitting) return;
    e.preventDefault();

    const database = getDb();
    const stored = readStoredCloseAction(database);
    if (stored === "tray") {
      win.hide();
      return;
    }
    if (stored === "quit") {
      if (isAutoBackupBusy()) {
        win.webContents.send("app:closeRequested");
        return;
      }
      markAppQuitting();
      app.quit();
      return;
    }

    if (win.webContents.isDestroyed() || win.webContents.isLoading()) {
      void promptNativeCloseChoice(win, database);
      return;
    }

    win.webContents.send("app:closeRequested");
  });
}

/** @deprecated Use installWindowCloseHandler */
export function installWindowCloseToTray(win: BrowserWindow): void {
  installWindowCloseHandler(win, () => null);
}

export function installTray(opts: {
  win: BrowserWindow;
  iconPath: string | undefined;
  getDb: () => Database.Database | null;
}): void {
  const { win, iconPath, getDb } = opts;
  const icon = loadTrayIcon(iconPath);
  if (icon.isEmpty()) return;

  tray = new Tray(icon);
  tray.setToolTip("Ishtarkati");

  const rebuildMenu = () => {
    const database = getDb();
    const t = trayStrings(database);
    const dueCount = countDueToday(database);
    const label =
      dueCount > 0 ? `${t.show} (${dueCount})` : t.show;
    const menu = Menu.buildFromTemplate([
      { label, click: () => showMainWindow(win) },
      { type: "separator" },
      {
        label: t.quit,
        click: () => {
          if (isAutoBackupBusy()) {
            showMainWindow(win);
            win.webContents.send("app:closeRequested");
            return;
          }
          markAppQuitting();
          app.quit();
        },
      },
    ]);
    tray?.setContextMenu(menu);
    if (dueCount > 0) {
      tray?.setToolTip(`${t.tooltipDue} (${dueCount})`);
    } else {
      tray?.setToolTip(t.tooltip);
    }
  };

  rebuildMenu();
  tray.on("click", () => showMainWindow(win));
  tray.on("right-click", () => rebuildMenu());

  setInterval(rebuildMenu, 5 * 60 * 1000);
}

export function showMainWindow(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function countDueToday(database: Database.Database | null): number {
  if (!database) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const row = database
    .prepare(
      `SELECT COUNT(*) AS n FROM subscriptions
       WHERE cancelled_at IS NULL
         AND billing_model != 'free_account'
         AND next_due_date IS NOT NULL
         AND next_due_date <= ?`,
    )
    .get(today) as { n: number };
  return Number(row?.n ?? 0);
}

function sentFlagPath(key: string): string {
  return path.join(app.getPath("userData"), `${key}.flag`);
}

function wasSentToday(flagKey: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const fp = sentFlagPath(`${flagKey}_${today}`);
  return fs.existsSync(fp);
}

function markSentToday(flagKey: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const fp = sentFlagPath(`${flagKey}_${today}`);
  try {
    fs.writeFileSync(fp, "1", "utf8");
  } catch {
    /* ignore */
  }
}

function runBackgroundReminders(database: Database.Database): void {
  if (dbGetSetting(database, "reminders_enabled") !== "1") return;
  if (!Notification.isSupported()) return;

  const n = notifyStrings(database);
  const today = new Date().toISOString().slice(0, 10);

  const dueToday = database
    .prepare(
      `SELECT title, amount_original, currency_code, account_label
       FROM subscriptions
       WHERE cancelled_at IS NULL
         AND billing_model != 'free_account'
         AND next_due_date IS NOT NULL
         AND next_due_date <= ?
       ORDER BY next_due_date ASC, title ASC
       LIMIT 8`,
    )
    .all(today) as Array<{
    title: string;
    amount_original: number;
    currency_code: string;
    account_label: string | null;
  }>;

  if (dueToday.length > 0 && !wasSentToday(DUE_TODAY_SENT_PREFIX)) {
    const lines = dueToday.map((s) => {
      const acc = s.account_label?.trim() ? ` (${s.account_label.trim()})` : "";
      return `• ${s.title}${acc}: ${s.amount_original} ${s.currency_code}`;
    });
    new Notification({
      title: n.dueTodayTitle,
      body: `${n.dueTodayIntro.replace("{{count}}", String(dueToday.length))}\n${lines.join("\n")}`,
    }).show();
    markSentToday(DUE_TODAY_SENT_PREFIX);
  }

  const daysStr = dbGetSetting(database, "reminder_due_days");
  const days = Math.max(1, Math.min(90, parseInt(daysStr ?? "7", 10) || 7));
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);
  const horizonStr = horizon.toISOString().slice(0, 10);

  const upcoming = database
    .prepare(
      `SELECT title, next_due_date, amount_original, currency_code
       FROM subscriptions
       WHERE cancelled_at IS NULL
         AND billing_model != 'free_account'
         AND next_due_date IS NOT NULL
         AND next_due_date > ?
         AND next_due_date <= ?
       ORDER BY next_due_date ASC
       LIMIT 10`,
    )
    .all(today, horizonStr) as Array<{
    title: string;
    next_due_date: string;
    amount_original: number;
    currency_code: string;
  }>;

  if (upcoming.length > 0 && !wasSentToday(REMINDER_SENT_PREFIX)) {
    const lines = upcoming.map(
      (s) => `• ${s.title}: ${s.next_due_date} — ${s.amount_original} ${s.currency_code}`,
    );
    new Notification({
      title: n.digestTitle,
      body: `${n.digestIntro.replace("{{count}}", String(upcoming.length)).replace("{{days}}", String(days))}\n${lines.join("\n")}`,
    }).show();
    markSentToday(REMINDER_SENT_PREFIX);
  }
}

export function tickBackgroundServices(getDb: () => Database.Database | null): void {
  const database = getDb();
  if (!database) return;
  runBackgroundReminders(database);
  runAutoBackupIfDue(database);
}

export function startBackgroundServices(getDb: () => Database.Database | null): void {
  if (backgroundTimer) clearInterval(backgroundTimer);
  setTimeout(() => tickBackgroundServices(getDb), 45_000);
  backgroundTimer = setInterval(() => tickBackgroundServices(getDb), 30 * 60 * 1000);
}

export async function runAutoBackupNow(
  getDb: () => Database.Database | null,
): Promise<{ ok: true; path: string } | { ok: false; error?: string; skipped?: boolean }> {
  const database = getDb();
  if (!database) return { ok: false, error: "no-database" };
  return runManualAutoBackup(database);
}

export async function chooseAutoBackupDir(
  win: BrowserWindow | null,
  getDb: () => Database.Database | null,
): Promise<{ ok: true; path: string } | { ok: false; canceled?: boolean }> {
  const database = getDb();
  const loc = readUiLocale(database);
  const title = loc === "en" ? localeEn.settings.autoBackupChooseDir : localeAr.settings.autoBackupChooseDir;
  const dlgOpts: OpenDialogOptions = {
    title,
    properties: ["openDirectory", "createDirectory"],
  };
  const { canceled, filePaths } =
    win && !win.isDestroyed()
      ? await dialog.showOpenDialog(win, dlgOpts)
      : await dialog.showOpenDialog(dlgOpts);
  if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };
  if (database) dbSetSetting(database, "auto_backup_dir", filePaths[0]);
  return { ok: true, path: filePaths[0] };
}

function parseSemver(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(".")
    .map((p) => parseInt(p, 10) || 0);
}

function semverGt(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return true;
    if (da < db) return false;
  }
  return false;
}

function platformAssetName(platform: NodeJS.Platform): string {
  if (platform === "win32") return "Ishtarkati-win-x64-setup.exe";
  if (platform === "darwin") return "Ishtarkati-mac-arm64.dmg";
  return "Ishtarkati-linux.AppImage";
}

export async function checkForAppUpdate(
  currentVersion: string,
  platform: NodeJS.Platform = process.platform,
): Promise<
  | {
      ok: true;
      latest: string;
      updateAvailable: boolean;
      url: string;
      downloadUrl: string;
      notes: string;
    }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch("https://api.github.com/repos/balnaimi/Ishtarkati/releases/latest", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Ishtarkati" },
    });
    if (!res.ok) return { ok: false, error: `http-${res.status}` };
    const data = (await res.json()) as {
      tag_name?: string;
      html_url?: string;
      body?: string;
      assets?: { name?: string; browser_download_url?: string }[];
    };
    const latest = (data.tag_name ?? "").replace(/^v/i, "");
    const url = data.html_url ?? "https://github.com/balnaimi/Ishtarkati/releases";
    if (!latest) return { ok: false, error: "no-tag" };
    const assetName = platformAssetName(platform);
    const matched = data.assets?.find((a) => a.name === assetName);
    const downloadUrl =
      matched?.browser_download_url ??
      `https://github.com/balnaimi/Ishtarkati/releases/latest/download/${assetName}`;
    return {
      ok: true,
      latest,
      updateAvailable: semverGt(latest, currentVersion),
      url,
      downloadUrl,
      notes: (data.body ?? "").trim(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
