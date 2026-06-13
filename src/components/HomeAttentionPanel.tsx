import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { HomeCardStat, SubscriptionListRow } from "../db/repo";
import { subscriptionNeedsPaidAttention } from "../db/repo";
import { creditCardPrimaryLine } from "../lib/creditCardDisplay";
import {
  computeDueProgress,
  dueProgressTone,
  dueToneTextClass,
  relativeDueCaption,
  type DueProgressInput,
} from "../lib/dueProgress";
import { tCardBrand } from "../lib/i18nLabels";
import { SiteFavicon } from "./SiteFavicon";

function progressInput(s: SubscriptionListRow): DueProgressInput {
  return {
    next_due_date: s.next_due_date,
    start_date: s.start_date,
    billing_model: s.billing_model,
    interval_unit: s.interval_unit,
    interval_months: s.interval_months,
    interval_count: Math.max(1, s.interval_count ?? 1),
  };
}

type Props = {
  dueToday: SubscriptionListRow[];
  dueSoon: SubscriptionListRow[];
  expiringCards: HomeCardStat[];
  onMarkPaid: (e: React.MouseEvent, id: number) => void;
};

export function HomeAttentionPanel({ dueToday, dueSoon, expiringCards, onMarkPaid }: Props) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const hasItems = dueToday.length > 0 || dueSoon.length > 0 || expiringCards.length > 0;

  return (
    <section className="dash-home-panel">
      <div className="dash-home-panel-head">
        <div>
          <h2 className="dash-card-title">{t("home.actionsTitle")}</h2>
          <p className="mt-0.5 text-xs sk-text-hint">{t("home.actionsSubtitle")}</p>
        </div>
        <Link to="/accounts" className="dash-btn-ghost !min-h-8 text-xs no-underline">
          {t("home.viewAccounts")}
        </Link>
      </div>

      {!hasItems ? (
        <p className="px-4 py-6 text-sm sk-text-hint">{t("home.actionsEmpty")}</p>
      ) : (
        <ul className="divide-y divide-cream-400/40">
          {dueToday.map((s) => {
            const prog = computeDueProgress(progressInput(s));
            const tone = prog ? dueProgressTone(prog) : null;
            const needsPaid = subscriptionNeedsPaidAttention(s);
            return (
              <li key={`today-${s.id}`}>
                <div className="dash-home-action-row dash-home-action-row-critical">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-start"
                    onClick={() => nav(`/sub/${s.id}`)}
                  >
                    <SiteFavicon websiteUrl={s.website_url} size="xs" className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-cream-950">{s.title}</span>
                      <span className="block text-[11px] sk-text-hint">
                        {s.next_due_date} · {s.amount_original} {s.currency_code}
                        {prog && tone ? (
                          <span className={`ms-1 ${dueToneTextClass(tone)}`}>
                            · {relativeDueCaption(t, prog)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  {needsPaid ? (
                    <button
                      type="button"
                      className="dash-btn-primary shrink-0 !min-h-7 px-2.5 py-1 text-[11px]"
                      onClick={(e) => onMarkPaid(e, s.id)}
                    >
                      {t("home.markPaid")}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}

          {dueSoon.map((s) => {
            const prog = computeDueProgress(progressInput(s));
            const tone = prog ? dueProgressTone(prog) : null;
            return (
              <li key={`soon-${s.id}`}>
                <button
                  type="button"
                  className="dash-home-action-row dash-home-action-row-warn w-full text-start"
                  onClick={() => nav(`/sub/${s.id}`)}
                >
                  <SiteFavicon websiteUrl={s.website_url} size="xs" className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-cream-950">{s.title}</span>
                    <span className="block text-[11px] sk-text-hint">
                      {t("home.dueSoonLine", { date: s.next_due_date ?? "—" })}
                      {prog && tone ? (
                        <span className={`ms-1 ${dueToneTextClass(tone)}`}>
                          · {relativeDueCaption(t, prog)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-cream-900">
                    {s.amount_original} {s.currency_code}
                  </span>
                </button>
              </li>
            );
          })}

          {expiringCards.map((c) => (
            <li key={`card-${c.id}`}>
              <Link
                to="/payments"
                className="dash-home-action-row dash-home-action-row-warn no-underline"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-warn/15 text-xs font-bold text-walnut-800">
                  !
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-cream-950">
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
                  </span>
                  <span className="block text-[11px] sk-text-hint">{t("home.cardExpiryLine")}</span>
                </span>
                <span className="shrink-0 text-[11px] font-medium text-walnut-800">
                  {t("payment.expiresShort", { m: c.exp_month, y: c.exp_year })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
