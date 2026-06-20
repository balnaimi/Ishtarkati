import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SubscriptionListRow } from "../db/repo";
import { subscriptionBillingPeriodLine } from "../lib/billingPeriodLabel";
import {
  accountPaymentStatus,
  accountPaymentStatusI18nKey,
  isFreeAccount,
} from "../lib/subscriptionKind";
import { platformTypeI18nKey } from "../lib/platformIdentity";
import { SiteFavicon } from "./SiteFavicon";

type Props = {
  accounts: SubscriptionListRow[];
};

function formatAddedDate(iso: string): string {
  if (!iso?.trim()) return "—";
  return iso.slice(0, 10);
}

export function HomeRecentAccountsPanel({ accounts }: Props) {
  const { t } = useTranslation();
  const nav = useNavigate();

  return (
    <section className="dash-home-panel">
      <div className="dash-home-panel-head">
        <div>
          <h2 className="dash-card-title">{t("home.recentAccountsTitle")}</h2>
          <p className="mt-0.5 text-xs sk-text-hint">{t("home.recentAccountsSubtitle")}</p>
        </div>
        <Link to="/accounts" className="dash-btn-ghost !min-h-8 text-xs no-underline">
          {t("home.viewAccounts")}
        </Link>
      </div>

      {accounts.length === 0 ? (
        <p className="px-4 py-6 text-sm sk-text-hint">{t("home.recentAccountsEmpty")}</p>
      ) : (
        <ul className="divide-y divide-cream-400/40">
          {accounts.map((s) => {
            const period = subscriptionBillingPeriodLine(s, t);
            const statusKey = accountPaymentStatusI18nKey(accountPaymentStatus(s));
            const meta = [t(statusKey), period, s.category_name, t(platformTypeI18nKey(s.platform_type ?? "website"))].filter(Boolean).join(" · ");

            return (
              <li key={s.id}>
                <button
                  type="button"
                  className="dash-home-action-row w-full text-start"
                  onClick={() => nav(`/sub/${s.id}`)}
                >
                  <SiteFavicon websiteUrl={s.website_url} size="xs" className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-cream-950">{s.title}</span>
                    <span className="block truncate text-[11px] sk-text-hint">
                      {t("home.addedOn", { date: formatAddedDate(s.created_at) })}
                      {meta ? ` · ${meta}` : null}
                    </span>
                  </span>
                  {!isFreeAccount(s) ? (
                    <span className="shrink-0 text-xs font-semibold text-cream-900">
                      {s.amount_original} {s.currency_code}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
