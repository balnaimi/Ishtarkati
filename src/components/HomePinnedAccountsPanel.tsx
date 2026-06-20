import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SubscriptionListRow } from "../db/repo";
import { SiteFavicon } from "./SiteFavicon";

type Props = {
  accounts: SubscriptionListRow[];
};

export function HomePinnedAccountsPanel({ accounts }: Props) {
  const { t } = useTranslation();
  const nav = useNavigate();

  if (accounts.length === 0) return null;

  return (
    <section className="dash-home-panel">
      <div className="dash-home-panel-head">
        <div>
          <h2 className="dash-card-title">{t("home.pinnedAccountsTitle")}</h2>
          <p className="mt-0.5 text-xs sk-text-hint">{t("home.pinnedAccountsSubtitle")}</p>
        </div>
        <Link to="/accounts" className="dash-btn-ghost !min-h-8 text-xs no-underline">
          {t("home.viewAccounts")}
        </Link>
      </div>

      <ul className="divide-y divide-cream-400/40">
        {accounts.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="dash-home-action-row w-full text-start"
              onClick={() => nav(`/sub/${s.id}`)}
            >
              <span className="flex size-7 shrink-0 items-center justify-center text-sm text-honey-800" aria-hidden>
                ★
              </span>
              <SiteFavicon websiteUrl={s.website_url} size="xs" className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-cream-950">{s.title}</span>
                {s.account_label?.trim() ? (
                  <span className="block truncate text-[11px] sk-text-hint" dir="ltr">
                    {s.account_label.trim()}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
