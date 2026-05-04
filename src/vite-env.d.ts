/// <reference types="vite/client" />

interface Window {
  ishtarkati: {
    dbSelect: (sql: string, params: unknown[]) => Promise<unknown[]>;
    dbExecute: (
      sql: string,
      params: unknown[],
    ) => Promise<{ changes: number; lastInsertRowid: number }>;
    openExternal: (url: string) => Promise<void>;
    backupExport: () => Promise<
      | { ok: true; path: string }
      | { ok: false; canceled?: boolean; error?: string }
    >;
    backupImport: () => Promise<
      | { ok: true }
      | { ok: false; canceled?: boolean; error?: string }
    >;
    showNotification: (opts: { title: string; body: string }) => Promise<boolean>;
  };
}
