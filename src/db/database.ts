/** Renderer-side DB access via Electron preload IPC (better-sqlite3 runs in main). */

export interface DbApi {
  select: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  execute: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rowsAffected: number; lastInsertId?: number }>;
  /** Atomic multi-statement commit (SQLite transaction in main process). */
  executeTransaction: (ops: Array<{ sql: string; params?: unknown[] }>) => Promise<void>;
}

const api: DbApi = {
  select: async <T>(sql: string, params: unknown[] = []) => {
    return (await window.ishtarkati.dbSelect(sql, params)) as T[];
  },
  execute: async (sql: string, params: unknown[] = []) => {
    const r = await window.ishtarkati.dbExecute(sql, params);
    return {
      rowsAffected: r.changes,
      lastInsertId: r.lastInsertRowid,
    };
  },
  executeTransaction: async (ops: Array<{ sql: string; params?: unknown[] }>) => {
    await window.ishtarkati.dbExecuteTransaction(ops);
  },
};

export async function getDb(): Promise<DbApi> {
  return api;
}
