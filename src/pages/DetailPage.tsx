import { useCallback, useEffect, useState } from "react";
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
} from "../lib/schedule";
import type { IntervalUnit } from "../types";
import { DueProgressBar } from "../components/DueProgressBar";
import { tagTokens } from "../lib/tags";

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

  async function handleDelete() {
    if (!id || !sub) return;
    if (!confirm(t("detail.confirmDeleteSub"))) return;
    await deleteSubscription(parseInt(id, 10));
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl font-semibold text-cream-900">{sub.title}</h2>
          <p className="text-sm text-cream-700">
            {sub.category_name ?? "—"}
            {sub.next_due_date ? ` · ${t("list.nextDue")}: ${sub.next_due_date}` : " · —"}
            {sub.start_date ? ` · ${t("form.startDate")}: ${sub.start_date}` : ""}
          </p>
          <p className="text-sm text-cream-800">
            {sub.amount_original} {sub.currency_code}
            {sub.amount_qar_snapshot != null
              ? ` · ≈ ${sub.amount_qar_snapshot.toFixed(2)} ${primaryCode}`
              : ""}
          </p>
          {sub.website_url ? (
            <a
              href={sub.website_url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm text-sage-800 underline-offset-2 hover:underline"
            >
              {sub.website_url}
            </a>
          ) : null}
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
            <p className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {t("detail.needsPaidHint")}
            </p>
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
          <button type="button" className="sk-btn-danger text-sm" onClick={() => void handleDelete()}>
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
        <h3 className="font-semibold text-cream-900">{t("detail.addPayment")}</h3>
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
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
            <input
              type="checkbox"
              className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
              checked={advanceRecurring}
              onChange={(e) => setAdvanceRecurring(e.target.checked)}
            />
            {t("detail.advanceRecurring")}
          </label>
        ) : null}
        <button type="button" className="sk-btn-primary w-full sm:w-auto" onClick={() => void handleRecordPayment()}>
          {t("detail.recordPayment")}
        </button>
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
                  <span className="me-2 ms-2">
                    {p.amount_original} {p.currency ?? ""}
                  </span>
                ) : null}
                {p.amount_qar != null ? (
                  <span className="font-medium text-sage-800">
                    ≈ {p.amount_qar.toFixed(2)} {primaryCode}
                  </span>
                ) : null}
                {p.renewal_years != null ? (
                  <span className="me-2 text-walnut-600">+{p.renewal_years} y</span>
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
  );
}
