/** Renderer-side DB access via Electron preload IPC (better-sqlite3 runs in main). */

export interface DbApi {
  select: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  execute: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rowsAffected: number; lastInsertId?: number }>;
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
};

export async function getDb(): Promise<DbApi> {
  return api;
}
