import { safeStorage } from "electron";
import type Database from "better-sqlite3";

export const SYNC_REMEMBER_SESSION = "sync_remember_session";
export const SYNC_PASSWORD_ENC_B64 = "sync_password_enc_b64";
export const SYNC_ACTIVITY_LOG_JSON = "sync_activity_log_json";
export const SYNC_CONFLICT_FLAG = "sync_conflict_pending";

export type SyncActivityKind =
  | "push_ok"
  | "push_fail"
  | "push_conflict"
  | "unlock"
  | "auto_unlock"
  | "create_vault"
  | "remote_newer";

export type SyncActivityEntry = {
  at: string;
  kind: SyncActivityKind;
  detail?: string;
};

const MAX_LOG = 20;

function dbGet(database: Database.Database, key: string): string | null {
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function dbSet(database: Database.Database, key: string, value: string): void {
  database.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

function dbDel(database: Database.Database, key: string): void {
  database.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export function isRememberSessionEnabled(database: Database.Database): boolean {
  return dbGet(database, SYNC_REMEMBER_SESSION) === "1";
}

export function readActivityLog(database: Database.Database): SyncActivityEntry[] {
  const raw = dbGet(database, SYNC_ACTIVITY_LOG_JSON);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as SyncActivityEntry[];
    return Array.isArray(arr) ? arr.slice(0, MAX_LOG) : [];
  } catch {
    return [];
  }
}

export function appendSyncActivityLog(
  database: Database.Database,
  kind: SyncActivityKind,
  detail?: string,
): void {
  const entry: SyncActivityEntry = {
    at: new Date().toISOString(),
    kind,
    ...(detail ? { detail: detail.slice(0, 200) } : {}),
  };
  const prev = readActivityLog(database);
  const next = [entry, ...prev].slice(0, MAX_LOG);
  dbSet(database, SYNC_ACTIVITY_LOG_JSON, JSON.stringify(next));
  if (kind === "push_conflict") {
    dbSet(database, SYNC_CONFLICT_FLAG, "1");
  } else if (kind === "push_ok") {
    dbDel(database, SYNC_CONFLICT_FLAG);
  }
}

export function hasConflictPending(database: Database.Database): boolean {
  return dbGet(database, SYNC_CONFLICT_FLAG) === "1";
}

export function saveRememberedPassword(database: Database.Database, password: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  try {
    const enc = safeStorage.encryptString(password);
    dbSet(database, SYNC_PASSWORD_ENC_B64, Buffer.from(enc).toString("base64"));
    dbSet(database, SYNC_REMEMBER_SESSION, "1");
    return true;
  } catch {
    return false;
  }
}

export function clearRememberedPassword(database: Database.Database): void {
  dbDel(database, SYNC_REMEMBER_SESSION);
  dbDel(database, SYNC_PASSWORD_ENC_B64);
}

export function loadRememberedPassword(database: Database.Database): string | null {
  if (!isRememberSessionEnabled(database)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  const b64 = dbGet(database, SYNC_PASSWORD_ENC_B64);
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, "base64");
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export type SyncStatusState =
  | "not_configured"
  | "locked"
  | "ready"
  | "pending"
  | "conflict";

export function computeSyncStatusState(opts: {
  configured: boolean;
  sessionUnlocked: boolean;
  autoPushPending: boolean;
  conflictPending: boolean;
}): SyncStatusState {
  if (!opts.configured) return "not_configured";
  if (opts.conflictPending) return "conflict";
  if (!opts.sessionUnlocked) return "locked";
  if (opts.autoPushPending) return "pending";
  return "ready";
}
