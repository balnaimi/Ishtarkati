import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiDir } from "../hooks/useUiDir";

export type CloseAction = "tray" | "quit";

interface CloseChoiceDialogProps {
  open: boolean;
  onCancel: () => void;
  backupBusy?: boolean;
}

export function CloseChoiceDialog({ open, onCancel, backupBusy = false }: CloseChoiceDialogProps) {
  const { t } = useTranslation();
  const dir = useUiDir();
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backupBlockMsg, setBackupBlockMsg] = useState(false);

  useEffect(() => {
    if (!open) {
      setRemember(false);
      setBusy(false);
      setBackupBlockMsg(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  async function choose(action: CloseAction) {
    if (action === "quit" && backupBusy) {
      setBackupBlockMsg(true);
      return;
    }
    setBusy(true);
    setBackupBlockMsg(false);
    try {
      const r = await window.ishtarkati.resolveClose({ action, remember });
      if (!r.ok && r.error === "backup-in-progress") {
        setBackupBlockMsg(true);
        return;
      }
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="sk-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        dir={dir}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-choice-title"
        className="sk-dialog-panel w-full max-w-md space-y-4 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="close-choice-title" className="text-lg font-semibold text-cream-950">
            {t("closeChoice.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-cream-800">{t("closeChoice.message")}</p>
          {backupBusy || backupBlockMsg ? (
            <p className="mt-2 text-sm font-medium text-orange-800 dark:text-orange-200">
              {t("closeChoice.backupBusy")}
            </p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
          <input
            type="checkbox"
            className="size-4 rounded border-cream-500 accent-violet-500"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          {t("closeChoice.remember")}
        </label>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="sk-btn-primary w-full"
            disabled={busy}
            onClick={() => void choose("tray")}
          >
            {t("closeChoice.background")}
          </button>
          <button
            type="button"
            className="sk-btn-secondary w-full"
            disabled={busy || backupBusy}
            onClick={() => void choose("quit")}
          >
            {t("closeChoice.quit")}
          </button>
          <button type="button" className="sk-btn-muted w-full" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
