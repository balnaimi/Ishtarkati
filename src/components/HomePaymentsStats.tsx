import { useTranslation } from "react-i18next";
import { CardExpiryBar } from "./CardExpiryBar";
import { creditCardPrimaryLine } from "../lib/creditCardDisplay";
import { tCardBrand, tPaymentService } from "../lib/i18nLabels";
import type {
  HomeCardStat,
  HomeRecentPaymentRow,
  HomeWalletStat,
} from "../db/repo";

type Props = {
  primaryCode: string;
  wallets: HomeWalletStat[];
  cards: HomeCardStat[];
  recentPayments: HomeRecentPaymentRow[];
};

function formatPrimary(amount: number, code: string): string {
  return `${amount.toFixed(2)} ${code}`;
}

function paymentViaLabel(
  t: ReturnType<typeof useTranslation>["t"],
  row: HomeRecentPaymentRow,
): string {
  if (row.wallet_method_id && row.wallet_service_code) {
    return `${tPaymentService(t, row.wallet_service_code)} — ${row.wallet_account_text ?? ""}`;
  }
  if (row.credit_card_id && row.card_brand && row.card_last4) {
    return `${tCardBrand(t, row.card_brand)} ·••• ${row.card_last4}`;
  }
  return t("home.paymentViaUnknown");
}

export function HomePaymentsStats({ primaryCode, wallets, cards, recentPayments }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-cream-900">{t("home.paymentMethodsSection")}</h3>
        {wallets.length === 0 ? (
          <p className="sk-text-hint text-sm">{t("payment.noWallets")}</p>
        ) : (
          <ul className="space-y-3">
            {wallets.map((w) => (
              <li key={w.id} className="sk-card space-y-2">
                <div>
                  <p className="font-semibold text-cream-950">
                    {tPaymentService(t, w.service_code)}
                  </p>
                  <p className="text-sm text-cream-800">{w.account_text}</p>
                  {w.linked_card_brand && w.linked_card_last4 ? (
                    <p className="mt-1 text-xs text-cream-600">
                      {t("payment.linkedCard")}:{" "}
                      {creditCardPrimaryLine(
                        {
                          id: w.linked_card_id!,
                          brand: w.linked_card_brand,
                          last4: w.linked_card_last4,
                          exp_month: 0,
                          exp_year: 0,
                          description: w.linked_card_description,
                          created_at: "",
                          updated_at: "",
                        },
                        tCardBrand(t, w.linked_card_brand),
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-cream-500">{t("home.noLinkedCard")}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="sk-text-hint text-xs">{t("home.paidLastMonth")}</p>
                    <p className="font-medium text-sage-800">
                      {formatPrimary(w.paidLastMonth, primaryCode)}
                    </p>
                  </div>
                  <div>
                    <p className="sk-text-hint text-xs">{t("home.projectedNextMonth")}</p>
                    <p className="font-medium text-sage-800">
                      {formatPrimary(w.projectedNextMonth, primaryCode)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-cream-900">
          {t("home.cardsSection", { count: cards.length })}
        </h3>
        {cards.length === 0 ? (
          <p className="sk-text-hint text-sm">{t("home.noCards")}</p>
        ) : (
          <ul className="space-y-3">
            {cards.map((c) => (
              <li key={c.id} className="sk-card space-y-3">
                <div>
                  <p className="font-semibold text-cream-950">
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
                  <p className="text-sm text-cream-700">
                    {t("payment.expiresShort", { m: c.exp_month, y: c.exp_year })}
                  </p>
                </div>
                <CardExpiryBar expMonth={c.exp_month} expYear={c.exp_year} />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="sk-text-hint text-xs">{t("home.paidLastMonth")}</p>
                    <p className="font-medium text-sage-800">
                      {formatPrimary(c.paidLastMonth, primaryCode)}
                    </p>
                  </div>
                  <div>
                    <p className="sk-text-hint text-xs">{t("home.projectedNextMonth")}</p>
                    <p className="font-medium text-sage-800">
                      {formatPrimary(c.projectedNextMonth, primaryCode)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-cream-900">{t("home.recentPayments")}</h3>
        {recentPayments.length === 0 ? (
          <p className="sk-text-hint text-sm">{t("home.noRecentPayments")}</p>
        ) : (
          <ul className="space-y-2">
            {recentPayments.map((row) => (
              <li
                key={row.id}
                className="sk-card flex flex-wrap items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-cream-950">{row.subscription_title}</p>
                  <p className="text-xs text-cream-600">{row.paid_at.slice(0, 10)}</p>
                  <p className="mt-0.5 text-xs text-sage-800">{paymentViaLabel(t, row)}</p>
                </div>
                <p className="shrink-0 font-semibold text-sage-800">
                  {row.amount_qar != null
                    ? formatPrimary(row.amount_qar, primaryCode)
                    : row.amount_original != null && row.currency
                      ? `${row.amount_original.toFixed(2)} ${row.currency}`
                      : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
