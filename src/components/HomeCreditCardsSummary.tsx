import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CreditCard } from "../types";
import { summarizeCreditCards } from "../lib/creditCardDisplay";
import { tCardBrand } from "../lib/i18nLabels";

type Props = {
  cards: CreditCard[];
};

export function HomeCreditCardsSummary({ cards }: Props) {
  const { t } = useTranslation();
  const summary = summarizeCreditCards(cards);

  if (summary.count === 0) {
    return (
      <div className="sk-card md:col-span-2">
        <p className="sk-text-hint text-sm font-medium">{t("home.cardsTitle")}</p>
        <p className="mt-2 text-sm text-cream-800">{t("home.noCards")}</p>
        <Link to="/payments" className="mt-2 inline-block text-sm font-medium text-sage-800 underline">
          {t("home.openPayments")}
        </Link>
      </div>
    );
  }

  const nearest = summary.nearestExpiry;
  const nearestLabel = nearest
    ? `${String(nearest.month).padStart(2, "0")}/${nearest.year}`
    : "—";

  return (
    <>
      <div className="sk-card">
        <p className="sk-text-hint text-sm font-medium">{t("home.cardsCount")}</p>
        <p className="mt-2 text-2xl font-semibold text-sage-800">{summary.count}</p>
        <Link to="/payments" className="mt-2 inline-block text-xs font-medium text-sage-800 underline">
          {t("home.openPayments")}
        </Link>
      </div>
      <div className="sk-card">
        <p className="sk-text-hint text-sm font-medium">{t("home.nearestCardExpiry")}</p>
        {nearest ? (
          <>
            <p className="mt-2 text-2xl font-semibold text-cream-950" dir="ltr">
              {nearestLabel}
            </p>
            <p className="sk-text-hint mt-2 text-xs">
              {tCardBrand(t, nearest.brand)} ·••• {nearest.last4}
            </p>
            <p className="mt-1 text-xs text-cream-700">
              {t("payment.monthsUntilExpiry", { count: nearest.monthsLeft })}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-cream-800">{t("home.allCardsExpired")}</p>
        )}
      </div>
      {summary.expiringSoonCount > 0 ? (
        <div className="sk-card border-walnut-300/60 bg-walnut-50/40">
          <p className="text-sm font-medium text-walnut-800">{t("home.cardsExpiringSoon")}</p>
          <p className="mt-2 text-2xl font-semibold text-walnut-700">
            {summary.expiringSoonCount}
          </p>
          <p className="sk-text-hint mt-2 text-xs">{t("home.cardsExpiringSoonHint")}</p>
        </div>
      ) : null}
      {summary.expiredCount > 0 ? (
        <div className="sk-card border-cream-500/80">
          <p className="text-sm font-medium text-cream-900">{t("home.cardsExpiredCount")}</p>
          <p className="mt-2 text-2xl font-semibold text-cream-950">{summary.expiredCount}</p>
        </div>
      ) : null}
    </>
  );
}
