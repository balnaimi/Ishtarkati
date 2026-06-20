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
  backupExport: () => ipcRenderer.invoke("backup:export"),
  backupPrepareImport: () => ipcRenderer.invoke("backup:prepareImport"),
  backupApplyImport: (payload: { filePath: string }) =>
    ipcRenderer.invoke("backup:applyImport", payload),
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
  showWindow: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("app:showWindow"),
  autoBackupRun: (): Promise<
    { ok: true; path: string } | { ok: false; error?: string; skipped?: boolean }
  > => ipcRenderer.invoke("backup:autoRun"),
  chooseAutoBackupDir: (): Promise<
    { ok: true; path: string } | { ok: false; canceled?: boolean }
  > => ipcRenderer.invoke("backup:chooseAutoDir"),
  checkForUpdates: (): Promise<
    | {
        ok: true;
        latest: string;
        updateAvailable: boolean;
        url: string;
        downloadUrl: string;
        notes: string;
      }
    | { ok: false; error: string }
  > => ipcRenderer.invoke("app:checkForUpdates"),
  getAutoBackupStatus: (): Promise<{
    phase: "hidden" | "ready" | "pending" | "running" | "ok" | "error";
    updatedAt: string;
    error?: string;
  }> => ipcRenderer.invoke("backup:getAutoStatus"),
  refreshAutoBackupStatus: (): Promise<{
    phase: "hidden" | "ready" | "pending" | "running" | "ok" | "error";
    updatedAt: string;
    error?: string;
  }> => ipcRenderer.invoke("backup:refreshAutoStatus"),
  onAutoBackupStatusChanged: (
    handler: (status: {
      phase: "hidden" | "ready" | "pending" | "running" | "ok" | "error";
      updatedAt: string;
      error?: string;
    }) => void,
  ): (() => void) => {
    const listener = (
      _evt: Electron.IpcRendererEvent,
      status: {
        phase: "hidden" | "ready" | "pending" | "running" | "ok" | "error";
        updatedAt: string;
        error?: string;
      },
    ) => handler(status);
    ipcRenderer.on("backup:autoStatusChanged", listener);
    return () => ipcRenderer.removeListener("backup:autoStatusChanged", listener);
  },
  onCloseRequested: (handler: () => void): (() => void) => {
    const listener = () => handler();
    ipcRenderer.on("app:closeRequested", listener);
    return () => ipcRenderer.removeListener("app:closeRequested", listener);
  },
  resolveClose: (payload: {
    action: "tray" | "quit";
    remember?: boolean;
  }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("app:resolveClose", payload),
});
