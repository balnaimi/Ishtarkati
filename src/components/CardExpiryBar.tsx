import { useTranslation } from "react-i18next";
import { cardExpiryProgress, DUE_TONE_BAR, DUE_TONE_TRACK } from "../lib/dueProgress";

type Props = {
  expMonth: number;
  expYear: number;
};

export function CardExpiryBar({ expMonth, expYear }: Props) {
  const { t } = useTranslation();
  const xp = cardExpiryProgress(expMonth, expYear);
  const tone =
    xp.monthsLeft < 0 ? "overdue" : xp.urgent ? "urgent" : xp.ratio > 0.75 ? "warn" : "safe";

  return (
    <div className="space-y-1">
      <p className="text-xs text-cream-600">
        {xp.monthsLeft < 0
          ? t("payment.cardExpired")
          : t("payment.monthsUntilExpiry", { count: xp.monthsLeft })}
      </p>
      <div
        className={`h-2 overflow-hidden rounded-full shadow-inner ${DUE_TONE_TRACK[tone]}`}
        title={t("payment.expiryBarHint")}
      >
        <div
          className={`h-2 rounded-full transition-[width] ${DUE_TONE_BAR[tone]}`}
          style={{ width: `${Math.round(xp.ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}
