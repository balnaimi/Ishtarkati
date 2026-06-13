import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { buildBackupPayloadFromDatabase } from "./backup";

export type AutoBackupResult = { ran: boolean; path?: string; error?: string };

export type AutoBackupOptions = {
  /** Injectable clock for tests (epoch ms). */
  now?: number;
  /** Fixed filename stamp for tests. */
  fileStamp?: string;
};

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

export type AutoBackupSkipReason = "disabled" | "no-dir" | "not-due";

export function autoBackupSkipReason(
  database: Database.Database,
  now: number = Date.now(),
): AutoBackupSkipReason | null {
  if (dbGetSetting(database, "auto_backup_enabled") !== "1") return "disabled";
  const dir = dbGetSetting(database, "auto_backup_dir")?.trim();
  if (!dir) return "no-dir";

  const daysStr = dbGetSetting(database, "auto_backup_days");
  const intervalDays = Math.max(1, Math.min(90, parseInt(daysStr ?? "7", 10) || 7));
  const lastAt = dbGetSetting(database, "last_auto_backup_at");
  if (lastAt) {
    const last = new Date(lastAt).getTime();
    const elapsed = now - last;
    if (elapsed < intervalDays * 86400000) return "not-due";
  }
  return null;
}

export function runAutoBackupIfDue(
  database: Database.Database,
  opts?: AutoBackupOptions,
): AutoBackupResult {
  const now = opts?.now ?? Date.now();
  const skip = autoBackupSkipReason(database, now);
  if (skip === "disabled" || skip === "not-due") return { ran: false };
  if (skip === "no-dir") return { ran: false, error: "no-dir" };

  const dir = dbGetSetting(database, "auto_backup_dir")!.trim();
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp =
      opts?.fileStamp ?? new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filePath = path.join(dir, `ishtarkati-auto-${stamp}.json`);
    const payload = buildBackupPayloadFromDatabase(database, "full");
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    dbSetSetting(database, "last_auto_backup_at", new Date(now).toISOString());
    return { ran: true, path: filePath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ran: false, error: msg };
  }
}

export function runManualAutoBackup(
  database: Database.Database,
  opts?: AutoBackupOptions,
): { ok: true; path: string } | { ok: false; error?: string } {
  const dir = dbGetSetting(database, "auto_backup_dir")?.trim();
  if (!dir) return { ok: false, error: "no-dir" };
  const now = opts?.now ?? Date.now();
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp =
      opts?.fileStamp ?? new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filePath = path.join(dir, `ishtarkati-manual-${stamp}.json`);
    const payload = buildBackupPayloadFromDatabase(database, "full");
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    dbSetSetting(database, "last_auto_backup_at", new Date(now).toISOString());
    return { ok: true, path: filePath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
