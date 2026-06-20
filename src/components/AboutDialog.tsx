import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../version";
import { ISHTARKATI_MARK_SRC } from "../lib/publicAssets";

const GITHUB_REPO_URL = "https://github.com/balnaimi/Ishtarkati";

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const paragraphs = [
    t("about.storyOrigin"),
    t("about.storyPurpose"),
    t("about.storyShare"),
    t("about.storyFree"),
  ];

  return (
    <div className="sk-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="sk-dialog-panel w-full max-w-md p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <img
            src={ISHTARKATI_MARK_SRC}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-xl ring-1 ring-violet-500/40"
            decoding="async"
          />
          <h2 id="about-dialog-title" className="text-lg font-semibold text-cream-950">
            {t("about.title")}
          </h2>
        </div>

        <div className="mt-4 space-y-3">
          {paragraphs.map((text) => (
            <p key={text} className="text-sm leading-relaxed text-cream-800">
              {text}
            </p>
          ))}
        </div>

        <p className="mt-4 text-xs sk-text-hint">{t("about.versionLine", { version: APP_VERSION })}</p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="sk-btn-secondary flex-1"
            onClick={() => void window.ishtarkati.openExternal(GITHUB_REPO_URL)}
          >
            {t("about.viewSource")}
          </button>
          <button type="button" className="sk-btn-primary flex-1" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
