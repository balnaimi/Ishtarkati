import type Database from "better-sqlite3";
import { autoBackupConfigured } from "./autoBackup";

export type AutoBackupStatusPhase =
  | "hidden"
  | "ready"
  | "pending"
  | "running"
  | "ok"
  | "error";

export type AutoBackupStatusSnapshot = {
  phase: AutoBackupStatusPhase;
  updatedAt: string;
  error?: string;
};

type Notifier = (snapshot: AutoBackupStatusSnapshot) => void;

let snapshot: AutoBackupStatusSnapshot = {
  phase: "hidden",
  updatedAt: new Date(0).toISOString(),
};

let notifier: Notifier | null = null;
let okResetTimer: ReturnType<typeof setTimeout> | null = null;

const OK_DISPLAY_MS = 6_000;

export function setAutoBackupStatusNotifier(fn: Notifier | null): void {
  notifier = fn;
}

export function getAutoBackupStatus(): AutoBackupStatusSnapshot {
  return snapshot;
}

export function isAutoBackupBusy(): boolean {
  return snapshot.phase === "pending" || snapshot.phase === "running";
}

function emit(next: AutoBackupStatusSnapshot): void {
  snapshot = next;
  notifier?.(snapshot);
}

function clearOkResetTimer(): void {
  if (okResetTimer) {
    clearTimeout(okResetTimer);
    okResetTimer = null;
  }
}

export function publishAutoBackupStatus(
  phase: AutoBackupStatusPhase,
  error?: string,
): void {
  clearOkResetTimer();
  emit({
    phase,
    updatedAt: new Date().toISOString(),
    error: error || undefined,
  });
  if (phase === "ok") {
    okResetTimer = setTimeout(() => {
      okResetTimer = null;
      if (snapshot.phase === "ok") {
        emit({ phase: "ready", updatedAt: new Date().toISOString() });
      }
    }, OK_DISPLAY_MS);
  }
}

export function refreshAutoBackupStatusFromDb(database: Database.Database): void {
  if (!autoBackupConfigured(database)) {
    if (snapshot.phase !== "hidden") {
      publishAutoBackupStatus("hidden");
    }
    return;
  }
  if (snapshot.phase === "hidden") {
    publishAutoBackupStatus("ready");
  }
}

/** @internal tests */
export function resetAutoBackupStatusForTests(): void {
  clearOkResetTimer();
  snapshot = { phase: "hidden", updatedAt: new Date(0).toISOString() };
}
