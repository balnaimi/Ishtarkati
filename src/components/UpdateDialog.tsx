import { useTranslation } from "react-i18next";
import { formatReleaseNotesBody } from "../lib/appUpdate";
import type { UpdateCheckState } from "../lib/appUpdate";

interface UpdateDialogProps {
  open: boolean;
  state: UpdateCheckState;
  currentVersion: string;
  onClose: () => void;
  onDismiss?: () => void;
}

export function UpdateDialog({
  open,
  state,
  currentVersion,
  onClose,
  onDismiss,
}: UpdateDialogProps) {
  const { t, i18n } = useTranslation();

  if (!open) return null;

  const lines = state.notes ? formatReleaseNotesBody(state.notes) : [];
  const hasUpdate = state.status === "available" && state.latest;

  async function openDownload() {
    const url = state.downloadUrl ?? state.releaseUrl;
    if (url) await window.ishtarkati.openExternal(url);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-dialog-title"
      onClick={onClose}
    >
      <div
        className="sk-dialog-panel max-h-[min(85vh,32rem)] w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-cream-400/60 px-5 py-4">
          <h2 id="update-dialog-title" className="text-lg font-semibold text-cream-950">
            {hasUpdate
              ? t("updates.dialogTitle", { version: state.latest })
              : t("updates.dialogCurrentTitle", { version: currentVersion })}
          </h2>
          {hasUpdate ? (
            <p className="mt-1 text-sm text-cream-700">
              {t("updates.dialogSubtitle", { current: currentVersion, latest: state.latest })}
            </p>
          ) : (
            <p className="mt-1 text-sm text-cream-700">{t("updates.dialogCurrentBody")}</p>
          )}
        </div>

        {hasUpdate && lines.length > 0 ? (
          <div className="max-h-52 overflow-y-auto px-5 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-cream-600">
              {t("updates.whatsNew")}
            </p>
            {i18n.language.startsWith("ar") && state.notesLocale === "en" ? (
              <p className="mb-2 text-xs text-cream-500">{t("updates.notesEnglishOnly")}</p>
            ) : null}
            <ul className="space-y-1.5 text-sm text-cream-800">
              {lines.map((line) => {
                if (line.startsWith("### ")) {
                  return (
                    <li key={line} className="pt-2 font-semibold text-cream-900">
                      {line.replace(/^###\s+/, "")}
                    </li>
                  );
                }
                if (line.startsWith("- ")) {
                  return (
                    <li key={line} className="ms-3 list-disc">
                      {line.replace(/^-\s+/, "")}
                    </li>
                  );
                }
                return (
                  <li key={line} className="text-cream-700">
                    {line}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-cream-400/60 px-5 py-4">
          {hasUpdate ? (
            <>
              {onDismiss ? (
                <button type="button" className="sk-btn-secondary" onClick={onDismiss}>
                  {t("updates.remindLater")}
                </button>
              ) : null}
              <button type="button" className="sk-btn-primary" onClick={() => void openDownload()}>
                {t("updates.download")}
              </button>
            </>
          ) : (
            <button type="button" className="sk-btn-primary" onClick={onClose}>
              {t("common.ok")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
