import { contextBridge, ipcRenderer } from "electron";

export interface DbExecuteResult {
  changes: number;
  lastInsertRowid: number;
}

contextBridge.exposeInMainWorld("ishtarkati", {
  dbSelect: (sql: string, params: unknown[]): Promise<unknown[]> =>
    ipcRenderer.invoke("db:select", sql, params),
  dbExecute: (sql: string, params: unknown[]): Promise<DbExecuteResult> =>
    ipcRenderer.invoke("db:execute", sql, params),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("shell:openExternal", url),
  backupExport: (): Promise<
    | { ok: true; path: string }
    | { ok: false; canceled?: boolean; error?: string }
  > => ipcRenderer.invoke("backup:export"),
  backupImport: (): Promise<
    | { ok: true }
    | { ok: false; canceled?: boolean; error?: string }
  > => ipcRenderer.invoke("backup:import"),
  showNotification: (opts: { title: string; body: string }): Promise<boolean> =>
    ipcRenderer.invoke("notification:show", opts),
  pinStatus: (): Promise<{ enabled: boolean; hasPin: boolean }> =>
    ipcRenderer.invoke("security:pinStatus"),
  setPin: (pin: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("security:setPin", pin),
  clearPin: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("security:clearPin"),
  verifyPin: (pin: string): Promise<boolean> => ipcRenderer.invoke("security:verifyPin", pin),
  resetLocalDatabase: (): Promise<{ ok: true } | { ok: false; error?: string }> =>
    ipcRenderer.invoke("app:resetLocalDatabase"),
});
