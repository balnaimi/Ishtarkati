import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { buildBackupPayloadFromDatabase } from "./backup";

export const LATEST_BACKUP_FILENAME = "ishtarkati-latest.json";
export const AUTO_BACKUP_PREFIX = "ishtarkati-auto-";
export const MANUAL_BACKUP_PREFIX = "ishtarkati-manual-";

export type AutoBackupResult = { ran: boolean; path?: string; error?: string };

export type AutoBackupOptions = {
  /** Injectable clock for tests (epoch ms). */
  now?: number;
  /** Fixed filename stamp for tests. */
  fileStamp?: string;
  /** Skip writing a timestamped history file (latest only). */
  latestOnly?: boolean;
};

const DEBOUNCE_MS = 2_000;
const DEFAULT_RETENTION_DAYS = 30;

let backupSideEffects = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingDb: Database.Database | null = null;

export function isMutatingSql(sql: string): boolean {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n\r]*/g, " ")
    .trim()
    .toUpperCase();
  return /^(INSERT|UPDATE|DELETE|REPLACE)\b/.test(stripped);
}

export function sqlBatchIsMutating(sqls: string[]): boolean {
  return sqls.some(isMutatingSql);
}

export function dbGetSetting(database: Database.Database, key: string): string | null {
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function dbSetSetting(database: Database.Database, key: string, value: string): void {
  database
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export function autoBackupConfigured(database: Database.Database): boolean {
  if (dbGetSetting(database, "auto_backup_enabled") !== "1") return false;
  return Boolean(dbGetSetting(database, "auto_backup_dir")?.trim());
}

export type AutoBackupSkipReason = "disabled" | "no-dir";

/** @deprecated Interval scheduling removed — kept for tests that assert folder readiness. */
export function autoBackupSkipReason(
  database: Database.Database,
  _now: number = Date.now(),
): AutoBackupSkipReason | null {
  if (dbGetSetting(database, "auto_backup_enabled") !== "1") return "disabled";
  const dir = dbGetSetting(database, "auto_backup_dir")?.trim();
  if (!dir) return "no-dir";
  return null;
}

export function autoBackupRetentionDays(database: Database.Database): number {
  const daysStr = dbGetSetting(database, "auto_backup_days");
  return Math.max(1, Math.min(365, parseInt(daysStr ?? String(DEFAULT_RETENTION_DAYS), 10) || DEFAULT_RETENTION_DAYS));
}

function fileStampFromNow(now: number): string {
  return new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function writeJsonAtomic(filePath: string, json: string): void {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, json, "utf8");
  fs.renameSync(tmp, filePath);
}

export function pruneAutoBackupHistory(
  dir: string,
  retentionDays: number,
  now: number = Date.now(),
): number {
  const cutoff = now - retentionDays * 86400000;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith(AUTO_BACKUP_PREFIX) || !name.endsWith(".json")) continue;
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch {
      /* skip unreadable entries */
    }
  }
  return removed;
}

export function writeAutoBackupSnapshot(
  database: Database.Database,
  opts?: AutoBackupOptions,
): { ok: true; path: string; latestPath: string } | { ok: false; error: string } {
  const dir = dbGetSetting(database, "auto_backup_dir")?.trim();
  if (!dir) return { ok: false, error: "no-dir" };

  const now = opts?.now ?? Date.now();
  backupSideEffects += 1;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = buildBackupPayloadFromDatabase(database, "full");
    const json = JSON.stringify(payload, null, 2);
    const latestPath = path.join(dir, LATEST_BACKUP_FILENAME);
    writeJsonAtomic(latestPath, json);

    let stampedPath = latestPath;
    if (!opts?.latestOnly) {
      const stamp = opts?.fileStamp ?? fileStampFromNow(now);
      stampedPath = path.join(dir, `${AUTO_BACKUP_PREFIX}${stamp}.json`);
      fs.writeFileSync(stampedPath, json, "utf8");
      pruneAutoBackupHistory(dir, autoBackupRetentionDays(database), now);
    }

    dbSetSetting(database, "last_auto_backup_at", new Date(now).toISOString());
    return { ok: true, path: stampedPath, latestPath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    backupSideEffects -= 1;
  }
}

export function runChangeTriggeredBackup(
  database: Database.Database,
  opts?: AutoBackupOptions,
): AutoBackupResult {
  if (!autoBackupConfigured(database)) return { ran: false };
  const skip = autoBackupSkipReason(database, opts?.now);
  if (skip === "disabled") return { ran: false };
  if (skip === "no-dir") return { ran: false, error: "no-dir" };

  const result = writeAutoBackupSnapshot(database, opts);
  if (!result.ok) return { ran: false, error: result.error };
  return { ran: true, path: result.path };
}

/** Debounced backup after UI/database mutations (coalesces rapid edits). */
export function scheduleBackupAfterDataChange(database: Database.Database): void {
  if (backupSideEffects > 0) return;
  if (!autoBackupConfigured(database)) return;
  pendingDb = database;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const db = pendingDb;
    pendingDb = null;
    if (db) runChangeTriggeredBackup(db);
  }, DEBOUNCE_MS);
}

/** @internal tests — flush pending debounced backup immediately. */
export function flushScheduledBackupForTests(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const db = pendingDb;
  pendingDb = null;
  if (db) runChangeTriggeredBackup(db);
}

/** Legacy scheduled tick — now runs change-style backup when configured (no day interval). */
export function runAutoBackupIfDue(
  database: Database.Database,
  opts?: AutoBackupOptions,
): AutoBackupResult {
  if (!autoBackupConfigured(database)) return { ran: false };
  const skip = autoBackupSkipReason(database, opts?.now);
  if (skip) {
    if (skip === "no-dir") return { ran: false, error: "no-dir" };
    return { ran: false };
  }
  return runChangeTriggeredBackup(database, opts);
}

export function runManualAutoBackup(
  database: Database.Database,
  opts?: AutoBackupOptions,
): { ok: true; path: string } | { ok: false; error?: string } {
  const dir = dbGetSetting(database, "auto_backup_dir")?.trim();
  if (!dir) return { ok: false, error: "no-dir" };
  const now = opts?.now ?? Date.now();
  backupSideEffects += 1;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp = opts?.fileStamp ?? fileStampFromNow(now);
    const filePath = path.join(dir, `${MANUAL_BACKUP_PREFIX}${stamp}.json`);
    const payload = buildBackupPayloadFromDatabase(database, "full");
    const json = JSON.stringify(payload, null, 2);
    fs.writeFileSync(filePath, json, "utf8");
    writeJsonAtomic(path.join(dir, LATEST_BACKUP_FILENAME), json);
    dbSetSetting(database, "last_auto_backup_at", new Date(now).toISOString());
    return { ok: true, path: filePath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    backupSideEffects -= 1;
  }
}
