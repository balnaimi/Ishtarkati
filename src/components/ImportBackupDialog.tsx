import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BackupImportApplyArgs, BackupImportPreview } from "../types/backupIPC";

type Props = {
  open: boolean;
  preview: BackupImportPreview | null;
  applying: boolean;
  onClose: () => void;
  onApply: (args: BackupImportApplyArgs) => void;
};

export function ImportBackupDialog({ open, preview, applying, onClose, onApply }: Props) {
  const { t } = useTranslation();

  const [strategy, setStrategy] = useState<"merge" | "replace">("merge");
  const [onDuplicateId, setOnDuplicateId] = useState<"keep_local" | "prefer_import">("keep_local");
  const [onSimilarSubscription, setOnSimilarSubscription] = useState<"keep_both" | "replace_local">(
    "keep_both",
  );

  useEffect(() => {
    if (!preview?.filePath) return;
    setStrategy("merge");
    setOnDuplicateId("keep_local");
    setOnSimilarSubscription("keep_both");
  }, [preview?.filePath]);

  if (!open || !preview) return null;

  function submit() {
    if (!preview) return;
    onApply({
      filePath: preview.filePath,
      strategy,
      onDuplicateId,
      onSimilarSubscription,
    });
  }

  return (
    <div className="sk-modal-overlay">
      <div
        dir="rtl"
        className="sk-card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto border-cream-500/70 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-cream-950">{t("backup.importWizardTitle")}</h3>

        <p className="text-xs text-cream-700">
          <span dir="ltr" className="font-mono break-all">
            {preview.filePath}
          </span>
        </p>
        <p className="text-sm text-cream-800">{t("backup.importWizardStats")}</p>
        <ul className="list-inside list-disc space-y-1 text-sm text-cream-800">
          <li>
            {t("backup.previewDbCounts", {
              subs: preview.counts.db.subscriptions,
              pays: preview.counts.db.payment_events,
              cats: preview.counts.db.categories,
            })}
          </li>
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

        {(preview.idConflicts.subscriptions > 0 ||
          preview.similarSubscriptions.length > 0 ||
          preview.similarTruncated) && (
          <div className="sk-callout-warning">
            <p className="font-medium">{t("backup.previewOverlapHeading")}</p>
            <p className="mt-1">
              {t("backup.previewConflictsSubs", {
                n: preview.idConflicts.subscriptions,
                cats: preview.idConflicts.categories,
                cards: preview.idConflicts.credit_cards,
                wallets: preview.idConflicts.wallet_methods,
                pays: preview.idConflicts.payment_events,
              })}
            </p>
            {preview.similarSubscriptions.length > 0 ? (
              <div className="sk-list-in-callout">
                <p className="mb-2 font-semibold text-cream-950">{t("backup.previewSimilarHeading")}</p>
                <ul className="space-y-2">
                  {preview.similarSubscriptions.map((pair) => (
                    <li key={`${pair.importId}-${pair.localId}`}>
                      <span className="text-cream-700">
                        #{pair.importId} ↔ #{pair.localId}
                      </span>
                      {" — "}
                      <span className="font-medium">{pair.importTitle}</span>
                      {" / "}
                      <span className="text-cream-800">{pair.localTitle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preview.similarTruncated ? (
              <p className="sk-text-hint mt-2 text-xs">{t("backup.previewSimilarTruncated")}</p>
            ) : null}
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-cream-900">{t("backup.strategyLegend")}</legend>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-cream-400/80 px-3 py-2">
            <input
              type="radio"
              name="imp-strategy"
              checked={strategy === "merge"}
              onChange={() => setStrategy("merge")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{t("backup.strategyMergeTitle")}</span>
              <span className="mt-1 block text-sm leading-relaxed text-cream-800">
                {t("backup.strategyMergeBody")}
              </span>
              <span className="mt-1 block text-xs sk-text-hint">{t("backup.mergeSettingsNote")}</span>
            </span>
          </label>
          <label className="sk-choice-row-danger">
            <input
              type="radio"
              name="imp-strategy"
              checked={strategy === "replace"}
              onChange={() => setStrategy("replace")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{t("backup.strategyReplaceTitle")}</span>
              <span className="mt-1 block text-sm leading-relaxed opacity-95">
                {t("backup.strategyReplaceBody")}
              </span>
            </span>
          </label>
        </fieldset>

        {strategy === "merge" ? (
          <fieldset className="space-y-3 border-t border-cream-400/60 pt-3">
            <legend className="text-sm font-semibold text-cream-900">{t("backup.policiesLegend")}</legend>

            <div className="space-y-1">
              <p className="text-sm font-medium text-cream-900">{t("backup.dupByIdLegend")}</p>
              <p className="sk-text-hint text-xs">{t("backup.dupByIdHint")}</p>
              <label className="flex gap-3 text-sm">
                <input
                  type="radio"
                  name="dup-id"
                  checked={onDuplicateId === "keep_local"}
                  onChange={() => setOnDuplicateId("keep_local")}
                  className="mt-1"
                />
                {t("backup.dupKeepLocal")}
              </label>
              <label className="flex gap-3 text-sm">
                <input
                  type="radio"
                  name="dup-id"
                  checked={onDuplicateId === "prefer_import"}
                  onChange={() => setOnDuplicateId("prefer_import")}
                  className="mt-1"
                />
                {t("backup.dupPreferImport")}
              </label>
            </div>

            <div className="space-y-1 border-t border-cream-400/40 pt-3">
              <p className="text-sm font-medium text-cream-900">{t("backup.similarLegend")}</p>
              <p className="sk-text-hint text-xs">{t("backup.similarHint")}</p>
              <label className="flex gap-3 text-sm">
                <input
                  type="radio"
                  name="similar"
                  checked={onSimilarSubscription === "keep_both"}
                  onChange={() => setOnSimilarSubscription("keep_both")}
                  className="mt-1"
                />
                {t("backup.similarKeepBoth")}
              </label>
              <label className="flex gap-3 text-sm">
                <input
                  type="radio"
                  name="similar"
                  checked={onSimilarSubscription === "replace_local"}
                  onChange={() => setOnSimilarSubscription("replace_local")}
                  className="mt-1"
                />
                {t("backup.similarReplaceLocal")}
              </label>
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-cream-400/60 pt-4">
          <button type="button" className="sk-btn-secondary" disabled={applying} onClick={onClose}>
            {t("backup.importCancel")}
          </button>
          <button type="button" className="sk-btn-primary" disabled={applying} onClick={submit}>
            {applying ? t("backup.importApplying") : t("backup.importConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
