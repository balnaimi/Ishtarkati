import { useTranslation } from "react-i18next";
import type { BackupImportPreview } from "../types/backupIPC";
import { useUiDir } from "../hooks/useUiDir";

type Props = {
  open: boolean;
  preview: BackupImportPreview | null;
  applying: boolean;
  onClose: () => void;
  onConfirm: (filePath: string) => void;
};

export function ImportBackupDialog({
  open,
  preview,
  applying,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const dir = useUiDir();

  if (!open || !preview) return null;

  return (
    <div className="sk-modal-overlay">
      <div
        dir={dir}
        className="sk-dialog-panel max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-5"
      >
        <h3 className="text-lg font-semibold text-cream-950">{t("backup.restoreConfirmTitle")}</h3>

        <p className="text-sm leading-relaxed text-cream-800">{t("backup.restoreConfirmBody")}</p>

        <p className="text-xs sk-text-hint">
          <span dir="ltr" className="font-mono break-all">
            {preview.filePath}
          </span>
        </p>

        <ul className="list-inside list-disc space-y-1 text-sm text-cream-800">
          <li>
            {t("backup.previewFileCounts", {
              subs: preview.counts.file.subscriptions,
              pays: preview.counts.file.payment_events,
              cats: preview.counts.file.categories,
              cards: preview.counts.file.credit_cards,
              wallets: preview.counts.file.wallet_methods,
            })}
          </li>
          <li>
            {t("backup.previewExportMeta", {
              v: preview.exportVersion,
              app: preview.backupAppVersion,
              when: preview.exportedAt ? preview.exportedAt : "—",
            })}
          </li>
        </ul>

        <div className="sk-callout-warning text-sm">
          <p className="font-medium">{t("backup.restoreWarningTitle")}</p>
          <p className="mt-1 leading-relaxed">{t("backup.restoreWarningBody")}</p>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-cream-400/60 pt-4">
          <button type="button" className="sk-btn-secondary" disabled={applying} onClick={onClose}>
            {t("backup.importCancel")}
          </button>
          <button
            type="button"
            className="sk-btn-primary"
            disabled={applying}
            onClick={() => onConfirm(preview.filePath)}
          >
            {applying ? t("backup.importApplying") : t("backup.restoreConfirmButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
