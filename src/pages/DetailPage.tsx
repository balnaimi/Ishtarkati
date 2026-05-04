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
    return <p className="text-slate-400">{t("common.loading")}</p>;
  }
  if (!sub) {
    return <p className="text-slate-400">{t("common.error")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{sub.title}</h2>
          <p className="text-sm text-slate-400">
            {sub.category_name ?? "—"} · {sub.next_due_date ?? "—"}
          </p>
          {sub.website_url ? (
            <a
              href={sub.website_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-sky-400 hover:underline"
            >
              {sub.website_url}
            </a>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/sub/${sub.id}/edit`}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
          >
            {t("common.edit")}
          </Link>
          <button
            type="button"
            className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-1.5 text-sm text-red-200 hover:bg-red-950"
            onClick={() => void handleDelete()}
          >
            {t("common.delete")}
          </button>
        </div>
      </div>

      {sub.notes ? (
        <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-slate-300">{sub.notes}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="font-medium text-white">{t("detail.addPayment")}</h3>
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-slate-400">{t("detail.paidAt")}</label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
            <label className="block text-xs text-slate-400">{t("list.amount")}</label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <label className="block text-xs text-slate-400">{t("detail.paymentNote")}</label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
            />
            {sub.billing_model === "recurring" ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={advanceRecurring}
                  onChange={(e) => setAdvanceRecurring(e.target.checked)}
                />
                {t("detail.advanceRecurring")}
              </label>
            ) : null}
            <button
              type="button"
              className="mt-2 rounded-lg bg-emerald-800 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
              onClick={() => void handleRecordPayment()}
            >
              {t("detail.recordPayment")}
            </button>
          </div>
        </div>

        {sub.is_domain ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h3 className="font-medium text-white">{t("detail.renewDomain")}</h3>
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-slate-400">{t("detail.renewalYears")}</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                value={renewYears}
                onChange={(e) => setRenewYears(e.target.value)}
              />
              <label className="block text-xs text-slate-400">{t("detail.paymentNote")}</label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                value={renewNote}
                onChange={(e) => setRenewNote(e.target.value)}
              />
              <button
                type="button"
                className="mt-2 rounded-lg bg-amber-800 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
                onClick={() => void handleDomainRenewal()}
              >
                {t("detail.recordRenewal")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 font-medium text-white">{t("detail.payments")}</h3>
        <ul className="space-y-2">
          {payments.length === 0 ? (
            <li className="text-slate-500">{t("common.none")}</li>
          ) : (
            payments.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-2 text-sm text-slate-300"
              >
                <span className="font-medium text-slate-100">{p.paid_at}</span>
                {p.amount_original != null ? (
                  <span className="ms-2">
                    {p.amount_original} {p.currency ?? ""}
                  </span>
                ) : null}
                {p.amount_qar != null ? (
                  <span className="ms-2 text-emerald-300">≈ {p.amount_qar.toFixed(2)} QAR</span>
                ) : null}
                {p.renewal_years != null ? (
                  <span className="ms-2 text-amber-200">+{p.renewal_years} y</span>
                ) : null}
                {p.note ? <p className="mt-1 text-xs text-slate-500">{p.note}</p> : null}
              </li>
            ))
          )}
        </ul>
      </div>

      <Link to="/" className="inline-block text-sm text-sky-400 hover:underline">
        ← {t("common.back")}
      </Link>
    </div>
  );
}
