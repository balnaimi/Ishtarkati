import { useTranslation } from "react-i18next";
import type { CreditCard, WalletMethod } from "../types";
import { summarizeCreditCards } from "../lib/creditCardDisplay";
import { tCardBrand, tPaymentService } from "../lib/i18nLabels";

type Props = {
  cards: CreditCard[];
  wallets: WalletMethod[];
};

export function HomePaymentsStats({ cards, wallets }: Props) {
  const { t } = useTranslation();
  const summary = summarizeCreditCards(cards);

  const nearest = summary.nearestExpiry;
  const nearestLabel = nearest
    ? `${String(nearest.month).padStart(2, "0")}/${nearest.year}`
    : "—";

  const serviceCounts = wallets.reduce<Record<string, number>>((acc, w) => {
    acc[w.service_code] = (acc[w.service_code] ?? 0) + 1;
    return acc;
  }, {});
  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="sk-card">
        <p className="sk-text-hint text-sm font-medium">{t("home.walletsCount")}</p>
        <p className="mt-2 text-2xl font-semibold text-sage-800">{wallets.length}</p>
        {wallets.length === 0 ? (
          <p className="sk-text-hint mt-2 text-xs">{t("payment.noWallets")}</p>
        ) : null}
      </div>

      <div className="sk-card">
        <p className="sk-text-hint text-sm font-medium">{t("home.cardsCount")}</p>
        <p className="mt-2 text-2xl font-semibold text-sage-800">{summary.count}</p>
        {summary.count === 0 ? (
          <p className="sk-text-hint mt-2 text-xs">{t("home.noCards")}</p>
        ) : null}
      </div>

      {topServices.length > 0 ? (
        <div className="sk-card md:col-span-2">
          <p className="sk-text-hint mb-3 text-sm font-medium">{t("home.walletsByService")}</p>
          <ul className="space-y-2">
            {topServices.map(([code, count]) => (
              <li
                key={code}
                className="flex flex-wrap justify-between gap-2 text-sm text-cream-800"
              >
                <span>{tPaymentService(t, code)}</span>
                <span className="font-medium text-sage-800">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.count > 0 ? (
        <>
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
      ) : null}
    </div>
  );
}
