import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SubscriptionFormValues } from "../types";
import { amountToQarFromUsdBase } from "../lib/fx";
import type { FxState } from "../lib/fxState";

interface SubscriptionFormProps {
  initial: SubscriptionFormValues;
  categories: { id: number; name: string }[];
  fx: FxState;
  onFetchFx: () => Promise<void>;
  onSubmit: (
    values: SubscriptionFormValues,
    qarInfo: { qar: number; fxFactor: number; fxAt: string },
  ) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function SubscriptionForm({
  initial,
  categories,
  fx,
  onFetchFx,
  onSubmit,
  onCancel,
  submitLabel,
}: SubscriptionFormProps) {
  const { t } = useTranslation();
  const [v, setV] = useState<SubscriptionFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setV(initial);
  }, [initial]);

  const qarPreview = useMemo(() => {
    const amt = parseFloat(v.amount_original.replace(",", "."));
    if (!fx.usdRates || Number.isNaN(amt)) {
      return {
        qar: null as number | null,
        fxFactor: null as number | null,
        error: null as string | null,
      };
    }
    try {
      const { qar, fxFactor } = amountToQarFromUsdBase(
        amt,
        v.currency_code || "USD",
        fx.usdRates,
        fx.overrides,
      );
      return { qar, fxFactor, error: null as string | null };
    } catch {
      return {
        qar: null,
        fxFactor: null,
        error: t("fx.fetchError"),
      };
    }
  }, [v.amount_original, v.currency_code, fx.usdRates, fx.overrides, t]);

  const setField = useCallback(
    <K extends keyof SubscriptionFormValues>(key: K, val: SubscriptionFormValues[K]) => {
      setV((prev) => ({ ...prev, [key]: val }));
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!v.title.trim()) {
      setErr(t("form.required"));
      return;
    }
    const amt = parseFloat(v.amount_original.replace(",", "."));
    if (Number.isNaN(amt)) {
      setErr(t("form.invalidNumber"));
      return;
    }
    if (v.billing_model === "recurring") {
      if (!v.interval_unit) {
        setErr(t("form.required"));
        return;
      }
      if (v.interval_unit === "custom_months") {
        const m = parseInt(v.interval_months, 10);
        if (Number.isNaN(m) || m < 1) {
          setErr(t("form.invalidNumber"));
          return;
        }
      }
    }
    if (!fx.usdRates || qarPreview.qar == null || qarPreview.fxFactor == null) {
      setErr(t("fx.fetchError"));
      return;
    }
    setBusy(true);
    try {
      const fxAt = fx.fetchedAt ?? new Date().toISOString();
      await onSubmit(v, { qar: qarPreview.qar, fxFactor: qarPreview.fxFactor, fxAt });
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-4">
      {err ? (
        <p className="rounded-lg border border-red-800 bg-red-950/80 px-3 py-2 text-sm text-red-100">
          {err}
        </p>
      ) : null}

      <div className="grid gap-2">
        <label className="text-sm text-slate-400">{t("form.title")}</label>
        <input
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
          value={v.title}
          onChange={(e) => setField("title", e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-slate-400">{t("form.notes")}</label>
        <textarea
          className="min-h-[80px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
          value={v.notes}
          onChange={(e) => setField("notes", e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-slate-400">{t("form.website")}</label>
        <input
          type="url"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
          value={v.website_url}
          onChange={(e) => setField("website_url", e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-slate-400">{t("form.category")}</label>
        <select
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
          value={v.category_id}
          onChange={(e) => setField("category_id", e.target.value)}
        >
          <option value="">{t("common.none")}</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.is_domain}
            onChange={(e) => setField("is_domain", e.target.checked)}
          />
          {t("form.isDomain")}
        </label>
      </div>

      <div className="grid gap-2">
        <label className="text-sm text-slate-400">{t("form.billingModel")}</label>
        <select
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
          value={v.billing_model}
          onChange={(e) =>
            setField("billing_model", e.target.value as SubscriptionFormValues["billing_model"])
          }
        >
          <option value="one_time">{t("billing.one_time")}</option>
          <option value="recurring">{t("billing.recurring")}</option>
          <option value="pay_as_needed">{t("billing.pay_as_needed")}</option>
        </select>
      </div>

      {v.billing_model === "recurring" ? (
        <>
          <div className="grid gap-2">
            <label className="text-sm text-slate-400">{t("form.interval")}</label>
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
              value={v.interval_unit}
              onChange={(e) =>
                setField("interval_unit", e.target.value as SubscriptionFormValues["interval_unit"])
              }
            >
              <option value="">—</option>
              <option value="month">{t("interval.month")}</option>
              <option value="quarter">{t("interval.quarter")}</option>
              <option value="year">{t("interval.year")}</option>
              <option value="custom_months">{t("interval.custom_months")}</option>
            </select>
          </div>
          {v.interval_unit === "custom_months" ? (
            <div className="grid gap-2">
              <label className="text-sm text-slate-400">{t("form.intervalMonths")}</label>
              <input
                type="number"
                min={1}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
                value={v.interval_months}
                onChange={(e) => setField("interval_months", e.target.value)}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.auto_renew}
            onChange={(e) => setField("auto_renew", e.target.checked)}
          />
          {t("form.autoRenew")}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <label className="text-sm text-slate-400">{t("form.amountOriginal")}</label>
          <input
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
            value={v.amount_original}
            onChange={(e) => setField("amount_original", e.target.value)}
            inputMode="decimal"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm text-slate-400">{t("form.currency")}</label>
          <input
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
            value={v.currency_code}
            onChange={(e) => setField("currency_code", e.target.value.toUpperCase())}
            placeholder="USD"
            required
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm">
        <p className="text-slate-400">{t("list.qar")}</p>
        <p className="text-lg font-semibold text-emerald-300">
          {qarPreview.qar != null ? qarPreview.qar.toFixed(2) : "—"}
        </p>
        {qarPreview.error ? <p className="text-red-300">{qarPreview.error}</p> : null}
        <button
          type="button"
          className="mt-2 rounded-md bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600"
          onClick={() => void onFetchFx()}
        >
          {t("form.recalcFx")}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <label className="text-sm text-slate-400">{t("form.startDate")}</label>
          <input
            type="date"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
            value={v.start_date}
            onChange={(e) => setField("start_date", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm text-slate-400">{t("form.nextDue")}</label>
          <input
            type="date"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
            value={v.next_due_date}
            onChange={(e) => setField("next_due_date", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm text-slate-400">{t("form.endDate")}</label>
          <input
            type="date"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
            value={v.end_date}
            onChange={(e) => setField("end_date", e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {submitLabel ?? t("common.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
