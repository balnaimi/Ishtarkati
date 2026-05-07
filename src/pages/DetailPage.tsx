import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  confirmSubscriptionPaid,
  deleteSubscription,
  getPrimaryCurrencyCode,
  getSubscription,
  insertPaymentEvent,
  listPayments,
  setSubscriptionNextDue,
  subscriptionNeedsPaidAttention,
  type SubscriptionListRow,
} from "../db/repo";
import type { PaymentEvent } from "../types";
import {
  addBillingSteps,
  formatDateInput,
  parseDateInput,
  listPaymentDatesThrough,
} from "../lib/schedule";
import type { IntervalUnit } from "../types";
import { DueProgressBar } from "../components/DueProgressBar";
import { DualCurrencyAmounts } from "../components/DualCurrencyAmounts";
import { SiteFavicon } from "../components/SiteFavicon";
import { tagTokens } from "../lib/tags";
import { displayUrlForUi } from "../lib/siteFavicon";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function DetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubscriptionListRow | null>(null);
  const [payments, setPayments] = useState<PaymentEvent[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");

  const [payDate, setPayDate] = useState(() => formatDateInput(new Date()));
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [advanceRecurring, setAdvanceRecurring] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [backfillFrom, setBackfillFrom] = useState("");
  const [backfillUntil, setBackfillUntil] = useState(() => formatDateInput(new Date()));
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfillAdvanceNext, setBackfillAdvanceNext] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const sid = parseInt(id, 10);
    try {
      const [s, p, prim] = await Promise.all([
        getSubscription(sid),
        listPayments(sid),
        getPrimaryCurrencyCode(),
      ]);
      setSub(s);
      setPayments(p);
      setPrimaryCode(prim);
      if (s) {
        setPayAmount(String(s.amount_original));
        setBackfillFrom(s.start_date?.slice(0, 10) ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  async function copyField(text: string, key: string) {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey("err");
      window.setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  useEffect(() => {
    void reload();
  }, [reload]);

  const paidDateKeys = useMemo(() => new Set(payments.map((p) => p.paid_at.slice(0, 10))), [payments]);

  async function handleDelete() {
    if (!id || !sub) return;
    await deleteSubscription(parseInt(id, 10));
    setDeleteConfirmOpen(false);
    nav("/");
  }

  async function handleRecordPayment() {
    if (!id || !sub) return;
    const sid = parseInt(id, 10);
    const paidAt = payDate;
    const amt = parseFloat(payAmount.replace(",", "."));
    const amountOriginal = Number.isNaN(amt) ? null : amt;
    const amountPrimary = sub.amount_qar_snapshot;
    await insertPaymentEvent(
      sid,
      paidAt,
      amountOriginal,
      sub.currency_code,
      amountPrimary,
      null,
      payNote.trim() || null,
    );
    if (sub.billing_model === "recurring" && advanceRecurring) {
      const base =
        parseDateInput(sub.next_due_date) ?? parseDateInput(paidAt) ?? new Date();
      const cnt = Math.max(1, sub.interval_count ?? 1);
      const next = addBillingSteps(base, sub.interval_unit as IntervalUnit | null, cnt);
      await setSubscriptionNextDue(sid, formatDateInput(next));
    }
    setPayNote("");
    void reload();
  }

  async function handleBackfillPayments() {
    if (!id || !sub) return;
    setBackfillMsg(null);
    if (sub.billing_model !== "recurring" || !sub.interval_unit) {
      setBackfillMsg(t("detail.backfillNeedsRecurring"));
      return;
    }
    const from = backfillFrom.trim();
    const until = backfillUntil.trim();
    if (!from || !until) {
      setBackfillMsg(t("detail.backfillNeedDates"));
      return;
    }
    if (until < from) {
      setBackfillMsg(t("detail.backfillUntilBeforeFrom"));
      return;
    }
    const sid = parseInt(id, 10);
    const cnt = Math.max(1, sub.interval_count ?? 1);
    const unit = sub.interval_unit as IntervalUnit;
    const allSlots = listPaymentDatesThrough(from, until, unit, cnt);
    const isoDates = allSlots.filter((d) => !paidDateKeys.has(d));
    if (isoDates.length === 0) {
      setBackfillMsg(t("detail.backfillNothingNew"));
      return;
    }

    const amtOriginal = Number.isFinite(sub.amount_original) ? sub.amount_original : null;
    const amtPrimary = sub.amount_qar_snapshot;
    const cur = sub.currency_code;
    const autoNote = t("detail.backfillNoteAuto");

    setBackfillBusy(true);
    try {
      for (const paidAt of isoDates) {
        await insertPaymentEvent(sid, paidAt, amtOriginal, cur, amtPrimary, null, autoNote);
      }
      if (backfillAdvanceNext && isoDates.length > 0) {
        const lastInserted = isoDates[isoDates.length - 1]!;
        let d = parseDateInput(lastInserted);
        const todayStr = formatDateInput(new Date());
        if (d) {
          let nextStr = formatDateInput(addBillingSteps(d, unit, cnt));
          let guard = 0;
          while (nextStr <= todayStr && guard < 5000) {
            d = parseDateInput(nextStr)!;
            nextStr = formatDateInput(addBillingSteps(d, unit, cnt));
            guard += 1;
          }
          await setSubscriptionNextDue(sid, nextStr);
        }
      }
      setBackfillMsg(t("detail.backfillDone", { count: isoDates.length }));
      void reload();
    } catch (e) {
      setBackfillMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBackfillBusy(false);
    }
  }

  async function handleMarkPaid() {
    if (!id) return;
    await confirmSubscriptionPaid(parseInt(id, 10));
    void reload();
  }

  if (loading) {
    return <p className="text-cream-700">{t("common.loading")}</p>;
  }
  if (!sub) {
    return <p className="text-cream-700">{t("common.error")}</p>;
  }

  const progSub = {
    next_due_date: sub.next_due_date,
    start_date: sub.start_date,
    billing_model: sub.billing_model,
    interval_unit: sub.interval_unit,
    interval_months: sub.interval_months,
    interval_count: Math.max(1, sub.interval_count ?? 1),
  };

  const needsPaid = subscriptionNeedsPaidAttention(sub);

  return (
    <>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t("confirmDialog.deleteTitle")}
        message={t("detail.confirmDeleteSub")}
        variant="danger"
        confirmLabel={t("common.delete")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
      <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 flex flex-col gap-3 text-start">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
            {sub.website_url?.trim() ? (
              <SiteFavicon websiteUrl={sub.website_url} size="lg" className="sm:mt-0.5" />
            ) : null}
            <div className="min-w-0 flex-1 space-y-2 text-start">
              <h2 className="text-xl font-semibold text-cream-900">{sub.title}</h2>
              <p className="text-sm text-cream-700">
                {sub.category_name ?? "—"}
                {sub.next_due_date ? ` · ${t("list.nextDue")}: ${sub.next_due_date}` : " · —"}
                {sub.start_date ? ` · ${t("form.startDate")}: ${sub.start_date}` : ""}
              </p>
              <div className="text-sm">
                <DualCurrencyAmounts
                  originalAmount={sub.amount_original}
                  originalCode={sub.currency_code}
                  approxAmount={sub.amount_qar_snapshot}
                  approxCode={primaryCode}
                />
              </div>
              {sub.website_url ? (
                <a
                  href={sub.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="sk-link-pill"
                >
                  <span dir="ltr" className="min-w-0 truncate font-medium">
                    {displayUrlForUi(sub.website_url)}
                  </span>
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="sk-btn-secondary text-xs"
              onClick={() => void copyField(sub.title, "title")}
            >
              {copiedKey === "title" ? t("detail.copied") : t("detail.copyTitle")}
            </button>
            {sub.next_due_date ? (
              <button
                type="button"
                className="sk-btn-secondary text-xs"
                onClick={() => void copyField(sub.next_due_date!, "due")}
              >
                {copiedKey === "due" ? t("detail.copied") : t("detail.copyDue")}
              </button>
            ) : null}
            {sub.website_url ? (
              <button
                type="button"
                className="sk-btn-secondary text-xs"
                onClick={() => void copyField(sub.website_url!, "url")}
              >
                {copiedKey === "url" ? t("detail.copied") : t("detail.copyUrl")}
              </button>
            ) : null}
            {needsPaid ? (
              <button type="button" className="sk-btn-primary text-xs" onClick={() => void handleMarkPaid()}>
                {t("home.markPaid")}
              </button>
            ) : null}
          </div>
          {needsPaid ? (
            <p className="sk-callout-warning text-sm">{t("detail.needsPaidHint")}</p>
          ) : null}
          {tagTokens(sub.tags).length ? (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium text-cream-600">{t("detail.tagsLabel")}</p>
              <div className="flex flex-wrap gap-1">
                {tagTokens(sub.tags).map((tag) => (
                  <span key={tag} className="sk-chip text-[11px]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/sub/${sub.id}/edit`} className="sk-btn-secondary text-sm">
            {t("common.edit")}
          </Link>
          <button type="button" className="sk-btn-danger text-sm" onClick={() => setDeleteConfirmOpen(true)}>
            {t("common.delete")}
          </button>
        </div>
      </div>

      {sub.next_due_date ? (
        <div className="sk-card space-y-3">
          <h3 className="font-semibold text-cream-900">{t("detail.dueProgressTitle")}</h3>
          <DueProgressBar sub={progSub} size="md" />
        </div>
      ) : null}

      {sub.notes ? (
        <p className="sk-card text-cream-800 leading-relaxed">{sub.notes}</p>
      ) : null}

      <div className="sk-card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-cream-900">{t("detail.paymentsSection")}</h3>
            <p className="mt-1 text-xs text-cream-600">{t("detail.paymentsSectionHint")}</p>
          </div>
          <button
            type="button"
            className="sk-btn-primary shrink-0 px-4"
            onClick={() => setPaymentsOpen((p) => !p)}
          >
            {paymentsOpen ? t("detail.closePaymentPanel") : t("detail.openPaymentPanel")}
          </button>
        </div>

        {paymentsOpen ? (
          <div className="space-y-6 border-t border-cream-400/80 pt-4">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-cream-900">{t("detail.addPayment")}</h4>
              <div>
                <label className="sk-label">{t("detail.paidAt")}</label>
                <input
                  type="date"
                  className="sk-input"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              <div>
                <label className="sk-label">{t("list.amount")}</label>
                <input
                  className="sk-input"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="sk-label">{t("detail.paymentNote")}</label>
                <input className="sk-input" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </div>
              {sub.billing_model === "recurring" ? (
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
                      checked={advanceRecurring}
                      onChange={(e) => setAdvanceRecurring(e.target.checked)}
                    />
                    <span>{t("detail.advanceRecurring")}</span>
                  </label>
                  <p className="text-xs leading-relaxed text-cream-600">{t("detail.advanceRecurringHint")}</p>
                </div>
              ) : null}
              <button
                type="button"
                className="sk-btn-primary w-full sm:w-auto"
                onClick={() => void handleRecordPayment()}
              >
                {t("detail.recordPayment")}
              </button>
            </div>

            {sub.billing_model === "recurring" && sub.interval_unit ? (
              <div className="space-y-4 border-t border-dashed border-cream-400/90 pt-6">
                <h4 className="text-sm font-semibold text-cream-900">{t("detail.backfillTitle")}</h4>
                <p className="text-xs leading-relaxed text-cream-600">{t("detail.backfillExplain")}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="sk-label">{t("detail.backfillFrom")}</label>
                    <input
                      type="date"
                      className="sk-input"
                      value={backfillFrom}
                      onChange={(e) => setBackfillFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="sk-label">{t("detail.backfillUntil")}</label>
                    <input
                      type="date"
                      className="sk-input"
                      value={backfillUntil}
                      onChange={(e) => setBackfillUntil(e.target.value)}
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
                    checked={backfillAdvanceNext}
                    onChange={(e) => setBackfillAdvanceNext(e.target.checked)}
                  />
                  <span>{t("detail.backfillAdvanceNext")}</span>
                </label>
                <button
                  type="button"
                  className="sk-btn-secondary w-full sm:w-auto"
                  disabled={backfillBusy}
                  onClick={() => void handleBackfillPayments()}
                >
                  {t("detail.backfillGenerate")}
                </button>
                {backfillMsg ? <p className="text-sm text-cream-800">{backfillMsg}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-cream-900">{t("detail.payments")}</h3>
        <ul className="space-y-3">
          {payments.length === 0 ? (
            <li className="text-cream-600">{t("common.none")}</li>
          ) : (
            payments.map((p) => (
              <li
                key={p.id}
                className="sk-card py-3 text-sm text-cream-800"
              >
                <span className="font-semibold text-cream-900">{p.paid_at}</span>
                {p.amount_original != null ? (
                  <div className="mt-2">
                    <DualCurrencyAmounts
                      size="sm"
                      originalAmount={p.amount_original}
                      originalCode={p.currency ?? sub.currency_code}
                      approxAmount={p.amount_qar}
                      approxCode={primaryCode}
                    />
                  </div>
                ) : p.amount_qar != null ? (
                  <span dir="ltr" className="mt-2 inline-flex gap-1 tabular-nums font-medium text-sage-800">
                    ≈ {p.amount_qar.toFixed(2)} {primaryCode}
                  </span>
                ) : null}
                {p.renewal_years != null ? (
                  <span className="me-2 mt-1 block text-xs text-walnut-600">+{p.renewal_years} y</span>
                ) : null}
                {p.note ? <p className="mt-2 text-xs text-cream-600">{p.note}</p> : null}
              </li>
            ))
          )}
        </ul>
      </div>

      <Link to="/" className="inline-flex text-sm font-medium text-sage-800 underline-offset-2 hover:underline">
        ← {t("common.back")}
      </Link>
    </div>
    </>
  );
}
