/** Mirrors the backup import preview DTO from the Electron IPC layer. */
export interface BackupImportPreview {
  filePath: string;
  exportVersion: number;
  exportScope: "full" | "without_settings";
  exportedAt: string;
  backupAppVersion: string;
  deviceLabel: string | null;
  counts: {
    db: {
      subscriptions: number;
      payment_events: number;
      categories: number;
      credit_cards: number;
      wallet_methods: number;
    };
    file: {
      subscriptions: number;
      payment_events: number;
      categories: number;
      credit_cards: number;
      wallet_methods: number;
    };
  };
  idConflicts: {
    subscriptions: number;
    categories: number;
    credit_cards: number;
    wallet_methods: number;
    payment_events: number;
  };
  similarSubscriptions: Array<{
    importId: number;
    localId: number;
    importTitle: string;
    localTitle: string;
  }>;
  similarTruncated: boolean;
}

export interface BackupImportApplyArgs {
  filePath: string;
}
