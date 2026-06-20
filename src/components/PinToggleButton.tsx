import type { ChangeEvent, MouseEvent } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  pinned: boolean;
  onToggle: () => void;
  className?: string;
  /** `compact` for account lists; `labeled` for detail with explanation. */
  variant?: "compact" | "labeled";
};

function stopBubble(e: MouseEvent) {
  e.stopPropagation();
}

export function PinToggleButton({
  pinned,
  onToggle,
  className = "",
  variant = "labeled",
}: Props) {
  const { t } = useTranslation();
  const label = t("accounts.pinToHomeLabel");
  const hint = t("accounts.pinToHomeHint");
  const short = t("accounts.pinToHomeShort");

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    if (e.target.checked !== pinned) onToggle();
  }

  if (variant === "compact") {
    return (
      <label
        className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
          pinned
            ? "border-honey-500/50 bg-honey-100/70 text-honey-950 dark:bg-honey-950/30 dark:text-honey-100"
            : "border-cream-400/80 bg-cream-100/50 text-cream-700 hover:border-cream-500 hover:bg-cream-200/60"
        } ${className}`.trim()}
        title={hint}
        onClick={stopBubble}
      >
        <input
          type="checkbox"
          className="size-3.5 shrink-0 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
          checked={pinned}
          onChange={handleChange}
          onClick={stopBubble}
          aria-label={label}
        />
        <span className="whitespace-nowrap font-medium leading-none">{short}</span>
      </label>
    );
  }

  return (
    <label
      className={`flex max-w-md cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-start transition-colors ${
        pinned
          ? "border-honey-500/45 bg-honey-50/60 dark:bg-honey-950/25"
          : "border-cream-400/70 bg-cream-100/40 hover:border-cream-500/80"
      } ${className}`.trim()}
      onClick={stopBubble}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
        checked={pinned}
        onChange={handleChange}
        onClick={stopBubble}
        aria-label={label}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-cream-900">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed sk-text-hint">{hint}</span>
      </span>
    </label>
  );
}
