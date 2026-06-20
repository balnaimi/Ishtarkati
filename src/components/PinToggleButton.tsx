import { useTranslation } from "react-i18next";

type Props = {
  pinned: boolean;
  onToggle: () => void;
  className?: string;
  size?: "sm" | "md";
};

export function PinToggleButton({ pinned, onToggle, className = "", size = "md" }: Props) {
  const { t } = useTranslation();
  const sizeClass = size === "sm" ? "size-7 text-sm" : "size-8 text-base";

  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center rounded-md transition-colors ${
        pinned
          ? "bg-honey-100/80 text-honey-900 hover:bg-honey-200/80 dark:bg-honey-950/40 dark:text-honey-200"
          : "bg-cream-200/60 text-cream-600 hover:bg-cream-300/70 hover:text-cream-800"
      } ${sizeClass} ${className}`.trim()}
      title={pinned ? t("accounts.unpin") : t("accounts.pin")}
      aria-label={pinned ? t("accounts.unpin") : t("accounts.pin")}
      aria-pressed={pinned}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {pinned ? "★" : "☆"}
    </button>
  );
}
