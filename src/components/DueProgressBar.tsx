import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  computeDueProgress,
  dueProgressTone,
  DUE_TONE_BAR,
  DUE_TONE_TRACK,
  dueProgressWidthPercent,
  type DueProgressInput,
} from "../lib/dueProgress";

function captionForDue(
  t: TFunction<"translation">,
  p: NonNullable<ReturnType<typeof computeDueProgress>>,
) {
  if (p.isOverdue) {
    const d = Math.abs(p.daysUntilDue);
    return t("due.captionOverdue", { count: d });
  }
  if (p.daysUntilDue <= 0) return t("due.captionToday");
  if (p.daysUntilDue === 1) return t("due.captionTomorrow");
  return t("due.captionDays", { count: p.daysUntilDue });
}

export function DueProgressBar({
  sub,
  size = "sm",
  showCaption = true,
}: {
  sub: DueProgressInput;
  size?: "sm" | "md";
  showCaption?: boolean;
}) {
  const { t } = useTranslation();
  const p = computeDueProgress(sub);
  if (!p) return null;
  const tone = dueProgressTone(p);
  const w = dueProgressWidthPercent(p);
  const barH = size === "md" ? "h-2.5" : "h-1.5";
  const caption = captionForDue(t, p);
  const pulse = tone === "overdue" || tone === "due" ? " motion-safe:animate-pulse" : "";

  return (
    <div className={size === "md" ? "w-full max-w-md" : "w-full min-w-0 max-w-full"}>
      <div
        className={`overflow-hidden rounded-full ${DUE_TONE_TRACK[tone]} ${barH} shadow-inner`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(w)}
        aria-label={caption}
      >
        <div
          className={`${DUE_TONE_BAR[tone]} ${barH} rounded-full transition-[width] duration-700 ease-out${pulse}`}
          style={{ width: `${w}%` }}
        />
      </div>
      {showCaption ? (
        <p
          className={`mt-1.5 text-xs font-medium leading-tight ${
            tone === "overdue" || tone === "due"
              ? "text-red-900"
              : tone === "urgent"
                ? "text-orange-900"
                : tone === "warn"
                  ? "text-amber-900"
                  : "text-cream-700"
          }`}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}
