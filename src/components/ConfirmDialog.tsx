import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="sk-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "sk-confirm-title" : undefined}
        className="sk-card max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto border-cream-500/70 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <h3 id="sk-confirm-title" className="text-lg font-semibold text-cream-950">
            {title}
          </h3>
        ) : null}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-cream-800">{message}</p>
        <div className="flex flex-wrap justify-start gap-2">
          <button
            type="button"
            className={`min-h-10 text-sm ${variant === "danger" ? "sk-btn-danger" : "sk-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("common.confirm")}
          </button>
          <button type="button" className="sk-btn-secondary min-h-10 text-sm" onClick={onCancel}>
            {cancelLabel ?? t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
