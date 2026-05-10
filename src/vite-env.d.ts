/// <reference types="vite/client" />

import type { BackupImportApplyArgs, BackupImportPreview } from "./types/backupIPC";

declare global {
  interface Window {
    ishtarkati: {
      dbSelect: (sql: string, params: unknown[]) => Promise<unknown[]>;
      dbExecute: (
        sql: string,
        params: unknown[],
      ) => Promise<{ changes: number; lastInsertRowid: number }>;
      openExternal: (url: string) => Promise<void>;
      backupExport: (opts?: { scope?: "full" | "without_settings" }) => Promise<
        | { ok: true; path: string }
        | { ok: false; canceled?: boolean; error?: string }
      >;
      backupPrepareImport: () => Promise<
        | { ok: true; preview: BackupImportPreview }
        | { ok: false; canceled?: boolean; error?: string }
      >;
      backupApplyImport: (
        payload: BackupImportApplyArgs,
      ) => Promise<{ ok: true } | { ok: false; error?: string }>;
      showNotification: (opts: { title: string; body: string }) => Promise<boolean>;
      pinStatus: () => Promise<{ enabled: boolean; hasPin: boolean }>;
      setPin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
      clearPin: () => Promise<{ ok: boolean }>;
      verifyPin: (pin: string) => Promise<boolean>;
      resetLocalDatabase: () => Promise<{ ok: true } | { ok: false; error?: string }>;
    };
  }
}

export {};
