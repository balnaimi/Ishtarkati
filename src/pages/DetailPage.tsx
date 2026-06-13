import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { formatUiError } from "../lib/uiErrors";
import {
  cancelSubscription,
  confirmSubscriptionPaid,
  deleteSubscription,
  stopSubscriptionKeepAccount,
  getPrimaryCurrencyCode,
  getSubscription,
  insertPaymentEvent,
  insertPaymentEventsBatch,
  listPayments,
  loadSubscriptionAuditLog,
  PAYMENT_NOTE_MARK_PAID,
  reactivateSubscription,
  setSubscriptionNextDue,
  subscriptionNeedsPaidAttention,
  type SubscriptionListRow,
} from "../db/repo";
import type { PaymentEvent, SubscriptionAuditEntry } from "../types";
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
import { displayUrlForUi } from "../lib/siteFavicon";
import {
  accountPaymentStatus,
  accountPaymentStatusI18nKey,
  isFreeAccount,
  isPaidSubscription,
} from "../lib/subscriptionKind";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { effectiveRenewalSteps } from "../lib/paymentRenewal";

function renewalStepUnitWord(t: TFunction, iu: IntervalUnit | null): string {
  if (!iu) return "";
  const keys: Record<IntervalUnit, string> = {
    day: "detail.renewalStepUnit.day",
    week: "detail.renewalStepUnit.week",
    month: "detail.renewalStepUnit.month",
    year: "detail.renewalStepUnit.year",
  };
  return t(keys[iu]);
}

export function DetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubscriptionListRow | null>(null);
  const [payments, setPayments] = useState<PaymentEvent[]>([]);
  const [auditLog, setAuditLog] = useState<SubscriptionAuditEntry[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");

  const [payDate, setPayDate] = useState(() => formatDateInput(new Date()));
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [advanceRecurring, setAdvanceRecurring] = useState(true);
  const [payRenewalSteps, setPayRenewalSteps] = useState("1");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [backfillFrom, setBackfillFrom] = useState("");
  const [backfillUntil, setBackfillUntil] = useState(() => formatDateInput(new Date()));
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfillAdvanceNext, setBackfillAdvanceNext] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [stopPayConfirmOpen, setStopPayConfirmOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const sid = parseInt(id, 10);
    try {
      const [s, p, prim, audit] = await Promise.all([
        getSubscription(sid),
        listPayments(sid),
        getPrimaryCurrencyCode(),
        loadSubscriptionAuditLog(sid),
      ]);
      setSub(s);
      setPayments(p);
      setPrimaryCode(prim);
      setAuditLog(audit);
      if (s) {
        setPayAmount(String(s.amount_original));
        setBackfillFrom(s.start_date?.slice(0, 10) ?? "");
        if (s.billing_model === "recurring") {
          setPayRenewalSteps(String(Math.max(1, s.interval_count ?? 1)));
        }
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
    const parsedSteps = parseInt(payRenewalSteps.trim(), 10);
    const renewalStepsForPayment =
      sub.billing_model === "recurring" &&
      sub.interval_unit &&
      Number.isFinite(parsedSteps) &&
      parsedSteps > 0
        ? parsedSteps
        : null;
    await insertPaymentEvent(
      sid,
      paidAt,
      amountOriginal,
      sub.currency_code,
      amountPrimary,
      renewalStepsForPayment,
      payNote.trim() || null,
    );
    if (sub.billing_model === "recurring" && advanceRecurring && sub.interval_unit) {
      const base =
        parseDateInput(sub.next_due_date) ?? parseDateInput(paidAt) ?? new Date();
      const cnt = renewalStepsForPayment ?? Math.max(1, sub.interval_count ?? 1);
      const next = addBillingSteps(base, sub.interval_unit as IntervalUnit, cnt);
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
      await insertPaymentEventsBatch(
        isoDates.map((paidAt) => ({
          subId: sid,
          paidAt,
          amountOriginal: amtOriginal,
          currency: cur,
          amountQar: amtPrimary,
          renewalStepCount: cnt,
          note: autoNote,
        })),
      );
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
      setBackfillMsg(formatUiError(t, e));
    } finally {
      setBackfillBusy(false);
    }
  }

  async function handleMarkPaid() {
    if (!id) return;
    try {
      await confirmSubscriptionPaid(parseInt(id, 10));
      void reload();
    } catch (err) {
      const detail = formatUiError(t, err);
      try {
        await window.ishtarkati.showNotification({
          title: t("home.markPaidErrorTitle"),
          body: `${t("home.markPaidErrorBody")} ${detail}`,
        });
      } catch {
        /* ignore notification failures */
      }
    }
  }

  async function handleReactivate() {
    if (!id) return;
    await reactivateSubscription(parseInt(id, 10));
    void reload();
  }

  async function handleMarkCancelled() {
    if (!id) return;
    await cancelSubscription(parseInt(id, 10));
    setCancelConfirmOpen(false);
    void reload();
  }

  async function handleStopSubscriptionKeepAccount() {
    if (!id) return;
    await stopSubscriptionKeepAccount(parseInt(id, 10));
    setStopPayConfirmOpen(false);
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
  const free = isFreeAccount(sub);
  const paid = isPaidSubscription(sub);
  const payStatus = accountPaymentStatus(sub);

  return (
    <>
      <ConfirmDialog
        open={cancelConfirmOpen}
        title={t("detail.accountDeletedTitle")}
        message={t("detail.accountDeletedConfirm")}
        confirmLabel={t("detail.accountDeletedConfirmBtn")}
        onConfirm={() => void handleMarkCancelled()}
        onCancel={() => setCancelConfirmOpen(false)}
      />
      <ConfirmDialog
        open={stopPayConfirmOpen}
        title={t("detail.stopPayTitle")}
        message={t("detail.stopPayConfirm")}
        confirmLabel={t("detail.stopPayConfirmBtn")}
        onConfirm={() => void handleStopSubscriptionKeepAccount()}
        onCancel={() => setStopPayConfirmOpen(false)}
      />
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
              {sub.cancelled_at ? (
                <div className="sk-callout-muted text-sm">
                  <p className="font-medium text-cream-900">{t("detail.cancelledBannerTitle")}</p>
                  <p className="mt-1 text-cream-800">{t("detail.cancelledBannerBody", { date: sub.cancelled_at })}</p>
                  <Link to="/accounts?tab=deleted" className="mt-2 inline-block text-sm font-medium text-sage-800 underline-offset-2 hover:underline">
                    {t("detail.cancelledBannerLink")}
                  </Link>
                </div>
              ) : null}
              {sub.trial_ends_on ? (
                <div className="sk-callout-muted text-sm">
                  <p className="font-medium text-cream-900">{t("detail.trialBannerTitle")}</p>
                  <p className="mt-1 text-cream-800">{t("detail.trialBannerBody", { date: sub.trial_ends_on.slice(0, 10) })}</p>
                </div>
              ) : null}
              {sub.renewal_cancelled ? (
                <div className="rounded-lg border border-honey-500/40 bg-honey-50/60 px-3 py-2 text-sm dark:bg-honey-950/20">
                  <p className="font-medium text-cream-900">{t("detail.renewalCancelledTitle")}</p>
                  <p className="mt-1 text-cream-800">{t("detail.renewalCancelledBody")}</p>
                </div>
              ) : null}
              {sub.tags?.trim() ? (
                <p className="text-sm text-cream-700">
                  {t("form.tags")}: {sub.tags}
                </p>
              ) : null}
              <p className="text-sm text-cream-700">
                <span className="rounded-md bg-cream-200/80 px-2 py-0.5 text-xs font-medium text-cream-900">
                  {t(accountPaymentStatusI18nKey(payStatus))}
                </span>
              </p>
              {sub.account_label?.trim() ? (
                <p className="text-sm text-cream-700" dir="ltr">
                  {free ? t("detail.freeEmail") : t("detail.accountLabel")}: {sub.account_label.trim()}
                </p>
              ) : null}
              <p className="text-sm text-cream-700">
                {sub.category_name ?? "—"}
                {!free && sub.next_due_date ? ` · ${t("list.nextDue")}: ${sub.next_due_date}` : ""}
                {sub.start_date
                  ? ` · ${free ? t("detail.freeCreatedAt") : t("form.startDate")}: ${sub.start_date}`
                  : ""}
              </p>
              {!free ? (
                <div className="text-sm">
                  <DualCurrencyAmounts
                    originalAmount={sub.amount_original}
                    originalCode={sub.currency_code}
                    approxAmount={sub.amount_qar_snapshot}
                    approxCode={primaryCode}
                  />
                </div>
              ) : null}
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
            {sub.account_label?.trim() ? (
              <button
                type="button"
                className="sk-btn-secondary text-xs"
                onClick={() => void copyField(sub.account_label!.trim(), "email")}
              >
                {copiedKey === "email" ? t("detail.copied") : t("detail.copyEmail")}
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
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/sub/${sub.id}/edit`} className="sk-btn-secondary text-sm">
            {t("common.edit")}
          </Link>
          {sub.cancelled_at ? (
            <button type="button" className="sk-btn-primary text-sm" onClick={() => void handleReactivate()}>
              {t("detail.reactivate")}
            </button>
          ) : (
            <>
              {paid ? (
                <button
                  type="button"
                  className="sk-btn-secondary text-sm"
                  onClick={() => setStopPayConfirmOpen(true)}
                >
                  {t("detail.stopPayBtn")}
                </button>
              ) : null}
              {free ? (
                <Link to={`/sub/${sub.id}/edit`} className="sk-btn-primary text-sm">
                  {t("detail.addPaidBtn")}
                </Link>
              ) : null}
              <button type="button" className="sk-btn-secondary text-sm" onClick={() => setCancelConfirmOpen(true)}>
                {t("detail.markAccountDeleted")}
              </button>
            </>
          )}
          <button type="button" className="sk-btn-danger text-sm" onClick={() => setDeleteConfirmOpen(true)}>
            {t("common.delete")}
          </button>
        </div>
      </div>

      {!free && sub.next_due_date && !sub.cancelled_at ? (
        <div className="sk-card space-y-3">
          <h3 className="font-semibold text-cream-900">{t("detail.dueProgressTitle")}</h3>
          <DueProgressBar sub={progSub} size="md" />
        </div>
      ) : null}

      {sub.notes ? (
        <div className="sk-card space-y-2">
          <h3 className="font-semibold text-cream-900">
            {free ? t("detail.freePurposeTitle") : t("form.notes")}
          </h3>
          <p className="text-cream-800 leading-relaxed">{sub.notes}</p>
        </div>
      ) : null}

      {!sub.cancelled_at ? (
        <div className="sk-callout-muted text-sm">
          <p>{free ? t("detail.freeAccountHint") : t("detail.paidAccountHint")}</p>
          <Link to="/accounts" className="mt-2 inline-block font-medium text-sage-800 underline">
            {t("home.openAccounts")}
          </Link>
        </div>
      ) : null}

      {!free ? (
      <>
      <div className="sk-card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-cream-900">{t("detail.paymentsSection")}</h3>
            <p className="mt-1 text-xs text-cream-600">{t("detail.paymentsSectionHint")}</p>
          </div>
          <button
            type="button"
            className="sk-btn-primary shrink-0 px-4"
            disabled={Boolean(sub.cancelled_at)}
            title={sub.cancelled_at ? t("detail.paymentsDisabledCancelled") : undefined}
            onClick={() => setPaymentsOpen((p) => !p)}
          >
            {paymentsOpen ? t("detail.closePaymentPanel") : t("detail.openPaymentPanel")}
          </button>
        </div>
        {sub.cancelled_at ? (
          <p className="text-xs text-cream-600">{t("detail.paymentsReadOnlyCancelled")}</p>
        ) : null}

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
              {sub.billing_model === "recurring" && sub.interval_unit ? (
                <div>
                  <label className="sk-label">{t("detail.renewalStepsThisPayment")}</label>
                  <input
                    type="number"
                    min={1}
                    className="sk-input max-w-xs"
                    value={payRenewalSteps}
                    onChange={(e) => setPayRenewalSteps(e.target.value)}
                  />
                  <p className="mt-1 text-xs leading-relaxed text-cream-600">{t("detail.renewalStepsHint")}</p>
                </div>
              ) : null}
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
            <>
              <li className="text-cream-600">{t("common.none")}</li>
              <li className="list-none rounded-lg border border-cream-400/70 bg-cream-50/90 px-3 py-2.5 text-xs leading-relaxed text-cream-800">
                {t("detail.paymentsLedgerEmptyExplain")}
              </li>
            </>
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
                {(() => {
                  const steps = effectiveRenewalSteps(p);
                  const iu = sub.interval_unit as IntervalUnit | null;
                  const unitWord = renewalStepUnitWord(t, iu);
                  return steps != null ? (
                    <span className="me-2 mt-1 block text-xs text-walnut-600">
                      {iu
                        ? t("detail.renewalStepsLine", { count: steps, unit: unitWord })
                        : t("detail.renewalStepsLineNoUnit", { count: steps })}
                    </span>
                  ) : null;
                })()}
                {p.note ? (
                  <p className="mt-2 text-xs text-cream-600">
                    {p.note === PAYMENT_NOTE_MARK_PAID
                      ? t("detail.paymentNoteMarkPaid")
                      : p.note}
                  </p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
      </>
      ) : null}

      {auditLog.length > 0 ? (
        <div className="sk-card space-y-3">
          <h3 className="text-base font-semibold text-cream-900">{t("detail.auditTitle")}</h3>
          <ul className="space-y-2 text-sm text-cream-800">
            {auditLog.map((e) => (
              <li key={e.id} className="border-b border-cream-300/60 pb-2 last:border-0">
                <span className="font-medium">{t(`detail.auditField.${e.field_name}`, { defaultValue: e.field_name })}</span>
                {" — "}
                <span dir="ltr">
                  {e.old_value ?? "—"} → {e.new_value ?? "—"}
                </span>
                <span className="mt-0.5 block text-xs text-cream-600">{e.changed_at.slice(0, 19)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link to="/" className="inline-flex text-sm font-medium text-sage-800 underline-offset-2 hover:underline">
        ← {t("common.back")}
      </Link>
    </div>
    </>
  );
}
