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
  syncGetLocalConfig: () => ipcRenderer.invoke("sync:getLocalConfig"),
  syncSaveLocalConfig: (payload: { baseUrl: string; vaultId: string }) =>
    ipcRenderer.invoke("sync:saveLocalConfig", payload),
  syncUnlockSession: (payload: { baseUrl: string; vaultId: string; password: string }) =>
    ipcRenderer.invoke("sync:unlockSession", payload),
  syncClearSession: () => ipcRenderer.invoke("sync:clearSession"),
  syncCapabilities: (payload: { baseUrl: string }) => ipcRenderer.invoke("sync:capabilities", payload),
  syncCreateVault: (payload: { baseUrl: string; password: string }) =>
    ipcRenderer.invoke("sync:createVault", payload),
  syncRemoteStatus: (payload: { baseUrl: string; vaultId: string }) =>
    ipcRenderer.invoke("sync:remoteStatus", payload),
  syncPullPreview: (payload: { baseUrl: string; vaultId: string; password: string }) =>
    ipcRenderer.invoke("sync:pullPreview", payload),
  syncRecordPulledRevision: (payload: { revision: number }) =>
    ipcRenderer.invoke("sync:recordPulledRevision", payload),
  syncPush: (payload: {
    baseUrl: string;
    vaultId: string;
    password: string;
    expectedRevision?: string | number;
    scope?: "full" | "without_settings";
  }) => ipcRenderer.invoke("sync:push", payload),
});
