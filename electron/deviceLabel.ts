import os from "node:os";
import type Database from "better-sqlite3";
import { DEVICE_NAME_KEY } from "../src/lib/settingsKeys";

export const AUTO_BACKUP_PREFIX = "ishtarkati-auto-";
export const MANUAL_BACKUP_PREFIX = "ishtarkati-manual-";

export function sanitizeDeviceLabelForFilename(raw: string, fallbackHostname: string): string {
  let label = raw.trim();
  if (!label) label = fallbackHostname.trim();
  label = label.replace(/[\u0000-\u001f/\\:*?"<>|]/g, "");
  label = label.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (!label) label = "device";
  if (label.length > 48) label = label.slice(0, 48);
  return label;
}

export function resolveDeviceLabelFromDb(database: Database.Database): string {
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(DEVICE_NAME_KEY) as
    | { value: string }
    | undefined;
  return sanitizeDeviceLabelForFilename(row?.value ?? "", os.hostname());
}

export function latestBackupFilename(deviceLabel: string): string {
  return `ishtarkati-latest-${deviceLabel}.json`;
}

export function autoBackupStampedFilename(deviceLabel: string, stamp: string): string {
  return `${AUTO_BACKUP_PREFIX}${deviceLabel}-${stamp}.json`;
}

export function manualBackupStampedFilename(deviceLabel: string, stamp: string): string {
  return `${MANUAL_BACKUP_PREFIX}${deviceLabel}-${stamp}.json`;
}

export function autoBackupHistoryPrefix(deviceLabel: string): string {
  return `${AUTO_BACKUP_PREFIX}${deviceLabel}-`;
}
