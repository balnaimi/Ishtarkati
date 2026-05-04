import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deleteSubscription,
  getSubscription,
  insertPaymentEvent,
  listPayments,
  setSubscriptionNextDue,
  type SubscriptionListRow,
} from "../db/repo";
import type { PaymentEvent } from "../types";
import {
  addBillingInterval,
  advanceNextDueAfterRenewal,
  formatDateInput,
  parseDateInput,
} from "../lib/schedule";
import type { IntervalUnit } from "../types";

export function DetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubscriptionListRow | null>(null);
  const [payments, setPayments] = useState<PaymentEvent[]>([]);

  const [payDate, setPayDate] = useState(() => formatDateInput(new Date()));
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [advanceRecurring, setAdvanceRecurring] = useState(true);

  const [renewYears, setRenewYears] = useState("1");
  const [renewNote, setRenewNote] = useState("");

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const sid = parseInt(id, 10);
    try {
      const [s, p] = await Promise.all([getSubscription(sid), listPayments(sid)]);
      setSub(s);
      setPayments(p);
      if (s) {
        setPayAmount(String(s.amount_original));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

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
    const amountQar = sub.amount_qar_snapshot;
    await insertPaymentEvent(
      sid,
      paidAt,
      amountOriginal,
      sub.currency_code,
      amountQar,
      null,
      payNote.trim() || null,
    );
    if (sub.billing_model === "recurring" && advanceRecurring) {
      const base =
        parseDateInput(sub.next_due_date) ?? parseDateInput(paidAt) ?? new Date();
      const next = addBillingInterval(
        base,
        sub.interval_unit as IntervalUnit | null,
        sub.interval_months,
      );
      await setSubscriptionNextDue(sid, formatDateInput(next));
    }
    setPayNote("");
    void reload();
  }

  async function handleDomainRenewal() {
    if (!id || !sub) return;
    const sid = parseInt(id, 10);
    const yrs = parseInt(renewYears, 10);
    if (Number.isNaN(yrs) || yrs < 1) return;
    const paidAt = payDate;
    const paidDate = parseDateInput(paidAt) ?? new Date();
    const next = advanceNextDueAfterRenewal(sub.next_due_date, yrs, paidDate);
    const amt = parseFloat(payAmount.replace(",", "."));
    await insertPaymentEvent(
      sid,
      paidAt,
      Number.isNaN(amt) ? sub.amount_original : amt,
      sub.currency_code,
      sub.amount_qar_snapshot,
      yrs,
      renewNote.trim() || null,
    );
    await setSubscriptionNextDue(sid, next);
    setRenewNote("");
    void reload();
  }

  if (loading) {
    return <p className="text-cream-700">{t("common.loading")}</p>;
  }
  if (!sub) {
    return <p className="text-cream-700">{t("common.error")}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl font-semibold text-cream-900">{sub.title}</h2>
          <p className="text-sm text-cream-700">
            {sub.category_name ?? "—"} · {sub.next_due_date ?? "—"}
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

      {sub.notes ? (
        <p className="sk-card text-cream-800 leading-relaxed">{sub.notes}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

        {sub.is_domain ? (
          <div className="sk-card space-y-4">
            <h3 className="font-semibold text-cream-900">{t("detail.renewDomain")}</h3>
            <div>
              <label className="sk-label">{t("detail.renewalYears")}</label>
              <input
                type="number"
                min={1}
                className="sk-input max-w-xs"
                value={renewYears}
                onChange={(e) => setRenewYears(e.target.value)}
              />
            </div>
            <div>
              <label className="sk-label">{t("detail.paymentNote")}</label>
              <input className="sk-input" value={renewNote} onChange={(e) => setRenewNote(e.target.value)} />
            </div>
            <button type="button" className="sk-btn-warm w-full sm:w-auto" onClick={() => void handleDomainRenewal()}>
              {t("detail.recordRenewal")}
            </button>
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
                  <span className="me-2 ms-2">
                    {p.amount_original} {p.currency ?? ""}
                  </span>
                ) : null}
                {p.amount_qar != null ? (
                  <span className="font-medium text-sage-800">≈ {p.amount_qar.toFixed(2)} QAR</span>
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
