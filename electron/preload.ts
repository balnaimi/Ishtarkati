import { contextBridge, ipcRenderer } from "electron";

export interface DbExecuteResult {
  changes: number;
  lastInsertRowid: number;
}

export interface DbTransactionOp {
  sql: string;
  params?: unknown[];
}

contextBridge.exposeInMainWorld("ishtarkati", {
  dbSelect: (sql: string, params: unknown[]): Promise<unknown[]> =>
    ipcRenderer.invoke("db:select", sql, params),
  dbExecute: (sql: string, params: unknown[]): Promise<DbExecuteResult> =>
    ipcRenderer.invoke("db:execute", sql, params),
  dbExecuteTransaction: (ops: DbTransactionOp[]): Promise<void> =>
    ipcRenderer.invoke("db:transaction", ops),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("shell:openExternal", url),
  backupExport: (opts?: { scope?: "full" | "without_settings" }) =>
    ipcRenderer.invoke("backup:export", opts ?? {}),
  backupPrepareImport: () => ipcRenderer.invoke("backup:prepareImport"),
  backupApplyImport: (payload: {
    filePath: string;
    strategy: "replace" | "merge";
    onDuplicateId: "keep_local" | "prefer_import";
    onSimilarSubscription: "keep_both" | "replace_local";
  }) => ipcRenderer.invoke("backup:applyImport", payload),
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
