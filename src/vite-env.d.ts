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
      syncGetLocalConfig: () => Promise<
        | {
            ok: true;
            baseUrl: string;
            vaultId: string;
            displayName: string;
            serverRevision: string;
            sessionUnlocked: boolean;
          }
        | { ok: false; error?: string }
      >;
      syncSaveLocalConfig: (payload: {
        baseUrl: string;
        vaultId: string;
        displayName?: string;
      }) => Promise<{ ok: true } | { ok: false; error?: string }>;
      syncLookupVaultByName: (payload: { baseUrl: string; name: string }) => Promise<
        | { ok: true; vaultId: string; displayName: string }
        | { ok: false; error?: string }
      >;
      syncUnlockSession: (payload: {
        baseUrl: string;
        vaultId: string;
        password: string;
      }) => Promise<
        | { ok: true; status: Record<string, unknown> }
        | { ok: false; error?: string }
      >;
      syncClearSession: () => Promise<{ ok: true }>;
      syncCapabilities: (payload: { baseUrl: string }) => Promise<
        | {
            ok: true;
            cap: {
              api_version: number;
              server_semver?: string;
              min_client_semver: string;
              max_backup_export_version: number;
            };
          }
        | { ok: false; error?: string }
      >;
      syncCreateVault: (payload: {
        baseUrl: string;
        password: string;
        displayName: string;
      }) => Promise<
        | { ok: true; vaultId: string; displayName: string }
        | { ok: false; error?: string }
      >;
      syncRemoteStatus: (payload: { baseUrl: string; vaultId: string }) => Promise<
        | {
            ok: true;
            cap: {
              api_version: number;
              server_semver?: string;
              min_client_semver: string;
              max_backup_export_version: number;
            };
            status: {
              vault_id: string;
              display_name?: string;
              revision: number;
              updated_at: string;
              has_snapshot: boolean;
              salt_b64: string;
              kdf: {
                memory: number;
                iterations: number;
                parallelism: number;
                keyLength: number;
              };
              min_client_semver: string;
              max_backup_export_version: number;
            };
          }
        | { ok: false; error?: string }
      >;
      syncPullPreview: (payload: {
        baseUrl: string;
        vaultId: string;
        password: string;
      }) => Promise<
        | {
            ok: true;
            preview: BackupImportPreview;
            backupJson: string;
            serverRevision: number;
          }
        | { ok: false; error?: string }
      >;
      syncRecordPulledRevision: (payload: { revision: number }) => Promise<
        { ok: true } | { ok: false; error?: string }
      >;
      syncPush: (payload: {
        baseUrl: string;
        vaultId: string;
        password: string;
        expectedRevision?: string | number;
        scope?: "full" | "without_settings";
      }) => Promise<
        | { ok: true; revision?: number }
        | { ok: false; error?: string; conflict?: true }
      >;
    };
  }
}

export {};
