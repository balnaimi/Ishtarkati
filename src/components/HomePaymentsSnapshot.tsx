import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { creditCardPrimaryLine } from "../lib/creditCardDisplay";
import { tCardBrand, tPaymentService } from "../lib/i18nLabels";
import type { HomeCardStat, HomeRecentPaymentRow, HomeWalletStat } from "../db/repo";

type Props = {
  primaryCode: string;
  wallets: HomeWalletStat[];
  cards: HomeCardStat[];
  recentPayments: HomeRecentPaymentRow[];
};

function formatPrimary(amount: number, code: string): string {
  return `${amount.toFixed(2)} ${code}`;
}

export function HomePaymentsSnapshot({ primaryCode, wallets, cards, recentPayments }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <section className="dash-home-panel">
        <div className="dash-home-panel-head">
          <h2 className="dash-card-title">{t("home.paymentsSnapshot")}</h2>
          <Link to="/payments" className="dash-btn-ghost !min-h-8 text-xs no-underline">
            {t("home.viewPayments")}
          </Link>
        </div>
        <div className="space-y-2 px-3 pb-3">
          {wallets.length === 0 && cards.length === 0 ? (
            <p className="py-2 text-sm sk-text-hint">{t("home.paymentsEmpty")}</p>
          ) : (
            <>
              {wallets.slice(0, 3).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-cream-400/40 px-2.5 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-cream-950">
                      {tPaymentService(t, w.service_code)}
                    </p>
                    <p className="truncate sk-text-hint">{w.account_text}</p>
                  </div>
                  <span className="shrink-0 font-medium text-cream-900">
                    {formatPrimary(w.projectedNextMonth, primaryCode)}
                  </span>
                </div>
              ))}
              {cards.slice(0, 2).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-cream-400/40 px-2.5 py-1.5 text-xs"
                >
                  <p className="min-w-0 truncate font-medium text-cream-950">
                    {creditCardPrimaryLine(
                      {
                        id: c.id,
                        brand: c.brand,
                        last4: c.last4,
                        exp_month: c.exp_month,
                        exp_year: c.exp_year,
                        description: c.description,
                        created_at: "",
                        updated_at: "",
                      },
                      tCardBrand(t, c.brand),
                    )}
                  </p>
                  <span className="shrink-0 sk-text-hint">
                    {t("payment.expiresShort", { m: c.exp_month, y: c.exp_year })}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <section className="dash-home-panel">
        <div className="dash-home-panel-head">
          <h2 className="dash-card-title">{t("home.recentPayments")}</h2>
        </div>
        {recentPayments.length === 0 ? (
          <p className="px-4 py-4 text-sm sk-text-hint">{t("home.noRecentPayments")}</p>
        ) : (
          <ul className="divide-y divide-cream-400/40">
            {recentPayments.slice(0, 5).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-cream-950">{row.subscription_title}</p>
                  <p className="sk-text-hint">{row.paid_at.slice(0, 10)}</p>
                </div>
                <span className="shrink-0 font-semibold text-sage-800">
                  {row.amount_qar != null
                    ? formatPrimary(row.amount_qar, primaryCode)
                    : row.amount_original != null && row.currency
                      ? `${row.amount_original.toFixed(2)} ${row.currency}`
                      : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
