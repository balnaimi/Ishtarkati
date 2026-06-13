import { useTranslation } from "react-i18next";

interface ShortcutsHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsHelpDialog({ open, onClose }: ShortcutsHelpDialogProps) {
  const { t } = useTranslation();
  if (!open) return null;

  const rows = [
    { keys: t("shortcuts.paletteKeys"), desc: t("shortcuts.palette") },
    { keys: t("shortcuts.newKeys"), desc: t("shortcuts.new") },
    { keys: t("shortcuts.helpKeys"), desc: t("shortcuts.help") },
    { keys: t("shortcuts.escapeKeys"), desc: t("shortcuts.escape") },
  ];

  return (
    <div className="sk-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="sk-dialog-panel w-full max-w-md p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("shortcuts.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-cream-950">{t("shortcuts.title")}</h2>
        <p className="mt-1 text-sm sk-text-hint">{t("shortcuts.subtitle")}</p>
        <dl className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.keys} className="flex items-start justify-between gap-4">
              <dt className="shrink-0 rounded-md border border-cream-400 bg-cream-100 px-2 py-1 font-mono text-xs text-cream-800">
                {r.keys}
              </dt>
              <dd className="text-sm text-cream-800">{r.desc}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="sk-btn-primary mt-5 w-full" onClick={onClose}>
          {t("common.confirm")}
        </button>
      </div>
    </div>
  );
}
