import type { TFunction } from "i18next";

/** Maps IPC / internal error codes to i18n keys (user-facing). */
const CODE_KEYS: Record<string, string> = {
  "no-database": "errors.noDatabase",
  "no-window": "errors.noWindow",
  "no-dir": "errors.noBackupDir",
  "bad_pin": "errors.badPin",
  "invalid-import-options": "errors.backupImportInvalid",
  "missing-backup-source": "errors.backupMissingSource",
  "db_transaction_invalid": "errors.database",
  "db_transaction_op_invalid": "errors.database",
};

function backupMessageKey(message: string): string | null {
  if (message === "Invalid backup file" || message === "Invalid backup JSON") {
    return "errors.backupInvalidFile";
  }
  if (message.startsWith("Unsupported backup version:")) {
    return "errors.backupUnsupportedVersion";
  }
  if (message.startsWith("Invalid backup:")) {
    return "errors.backupInvalidFile";
  }
  if (/^Invalid (credit card|wallet|currency|category|subscription|payment|settings) row$/i.test(message)) {
    return "errors.backupCorruptRow";
  }
  return null;
}

function fxMessageKey(message: string): string | null {
  if (/Missing FX rate for/i.test(message)) {
    return "fx.rateMissingHint";
  }
  return null;
}

function updateCheckKey(message: string): string | null {
  if (message.startsWith("http-")) return "errors.network";
  if (message === "no-tag") return "errors.updateCheckFailed";
  return null;
}

/**
 * Turn thrown errors, IPC codes, or English internal messages into localized UI text.
 * Never surfaces raw developer English to the user when a translation exists.
 */
export function formatUiError(t: TFunction, raw: unknown): string {
  const message =
    raw instanceof Error ? raw.message.trim() : String(raw ?? "").trim();
  if (!message) return t("errors.generic");

  const codeKey = CODE_KEYS[message];
  if (codeKey) return t(codeKey);

  const backupKey = backupMessageKey(message);
  if (backupKey) return t(backupKey);

  const fxKey = fxMessageKey(message);
  if (fxKey) return t(fxKey);

  const updateKey = updateCheckKey(message);
  if (updateKey) return t(updateKey);

  if (/UNIQUE|constraint/i.test(message)) return t("categories.duplicate");
  if (/Database not ready|db_transaction/i.test(message)) return t("errors.database");

  return t("errors.generic");
}
