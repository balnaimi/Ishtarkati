/// <reference types="vite/client" />

interface Window {
  ishtarkati: {
    dbSelect: (sql: string, params: unknown[]) => Promise<unknown[]>;
    dbExecute: (
      sql: string,
      params: unknown[],
    ) => Promise<{ changes: number; lastInsertRowid: number }>;
    openExternal: (url: string) => Promise<void>;
  };
}
