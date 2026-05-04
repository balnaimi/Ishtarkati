import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SubscriptionFormValues } from "../types";
import { amountToQarFromUsdBase } from "../lib/fx";
import type { FxState } from "../lib/fxState";
import { addCategory, loadCategories } from "../db/repo";

interface SubscriptionFormProps {
  initial: SubscriptionFormValues;
  categories: { id: number; name: string }[];
  currencies: { code: string }[];
  fx: FxState;
  onFetchFx: () => Promise<void>;
  onMetaUpdated: () => Promise<void>;
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
  currencies,
  fx,
  onFetchFx,
  onMetaUpdated,
  onSubmit,
  onCancel,
  submitLabel,
}: SubscriptionFormProps) {
  const { t } = useTranslation();
  const [v, setV] = useState<SubscriptionFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addCatBusy, setAddCatBusy] = useState(false);

  useEffect(() => {
    setV(initial);
  }, [initial]);

  const cur = (v.currency_code || "").trim().toUpperCase();
  const isQar = cur === "QAR";
  const showFxQarCard = cur.length > 0 && !isQar;
  const currencyOptions = useMemo(() => {
    const codes = currencies.map((c) => c.code);
    if (cur && !codes.includes(cur)) {
      return [{ code: cur, orphan: true }, ...currencies.map((c) => ({ code: c.code, orphan: false }))];
    }
    return currencies.map((c) => ({ code: c.code, orphan: false }));
  }, [currencies, cur]);

  const qarPreview = useMemo(() => {
    const amt = parseFloat(v.amount_original.replace(",", "."));
    if (Number.isNaN(amt)) {
      return {
        qar: null as number | null,
        fxFactor: null as number | null,
        error: null as string | null,
      };
    }
    if (isQar) {
      return { qar: amt, fxFactor: 1, error: null as string | null };
    }
    if (!cur) {
      return {
        qar: null,
        fxFactor: null,
        error: null as string | null,
      };
    }
    try {
      const { qar, fxFactor } = amountToQarFromUsdBase(
        amt,
        cur,
        fx.usdRates,
        fx.overrides,
      );
      return { qar, fxFactor, error: null as string | null };
    } catch {
      return {
        qar: null,
        fxFactor: null,
        error: t("fx.rateMissingHint"),
      };
    }
  }, [v.amount_original, cur, isQar, fx.usdRates, fx.overrides, t]);

  const setField = useCallback(
    <K extends keyof SubscriptionFormValues>(key: K, val: SubscriptionFormValues[K]) => {
      setV((prev) => ({ ...prev, [key]: val }));
    },
    [],
  );

  async function handleInlineAddCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setAddCatBusy(true);
    setErr(null);
    try {
      const existing = await loadCategories();
      const nextOrder = existing.length ? Math.max(...existing.map((c) => c.sort_order)) + 1 : 0;
      const newId = await addCategory(name, nextOrder);
      await onMetaUpdated();
      setField("category_id", String(newId));
      setNewCatName("");
      setAddCatOpen(false);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/UNIQUE|constraint/i.test(m)) setErr(t("categories.duplicate"));
      else setErr(m);
    } finally {
      setAddCatBusy(false);
    }
  }

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
    if (!v.currency_code.trim()) {
      setErr(t("form.currencyRequired"));
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

    let qar: number;
    let fxFactor: number;
    let fxAt: string;
    if (isQar) {
      qar = amt;
      fxFactor = 1;
      fxAt = new Date().toISOString();
    } else {
      if (qarPreview.qar == null || qarPreview.fxFactor == null) {
        setErr(qarPreview.error ?? t("fx.fetchError"));
        return;
      }
      qar = qarPreview.qar;
      fxFactor = qarPreview.fxFactor;
      fxAt = fx.fetchedAt ?? new Date().toISOString();
    }

    setBusy(true);
    try {
      await onSubmit(v, { qar, fxFactor, fxAt });
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5 md:space-y-6">
      {err ? <p className="sk-alert">{err}</p> : null}

      <div>
        <label className="sk-label">{t("form.title")}</label>
        <input
          className="sk-input"
          value={v.title}
          onChange={(e) => setField("title", e.target.value)}
          required
        />
      </div>

      <div>
        <label className="sk-label">{t("form.notes")}</label>
        <textarea
          className="sk-textarea"
          value={v.notes}
          onChange={(e) => setField("notes", e.target.value)}
        />
      </div>

      <div>
        <label className="sk-label">{t("form.website")}</label>
        <input
          type="url"
          className="sk-input"
          value={v.website_url}
          onChange={(e) => setField("website_url", e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <label className="sk-label">{t("form.category")}</label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <select
            className="sk-select min-w-0 flex-1"
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
          <button
            type="button"
            className="sk-btn-secondary shrink-0"
            onClick={() => setAddCatOpen((o) => !o)}
          >
            {t("form.addCategoryHere")}
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-cream-600">{t("form.noCategoriesHint")}</p>
        ) : null}
        {addCatOpen ? (
          <div className="sk-card flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="sk-label">{t("categories.name")}</label>
              <input
                className="sk-input"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={t("form.newCategoryPlaceholder")}
              />
            </div>
            <button
              type="button"
              disabled={addCatBusy || !newCatName.trim()}
              className="sk-btn-primary"
              onClick={() => void handleInlineAddCategory()}
            >
              {t("categories.add")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
          <input
            type="checkbox"
            className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
            checked={v.is_domain}
            onChange={(e) => setField("is_domain", e.target.checked)}
          />
          {t("form.isDomain")}
        </label>
      </div>

      <div>
        <label className="sk-label">{t("form.billingModel")}</label>
        <select
          className="sk-select"
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
        <div className="space-y-5 border-t border-cream-400/80 pt-5">
          <div>
            <label className="sk-label">{t("form.interval")}</label>
            <select
              className="sk-select"
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
            <div>
              <label className="sk-label">{t("form.intervalMonths")}</label>
              <input
                type="number"
                min={1}
                className="sk-input max-w-xs"
                value={v.interval_months}
                onChange={(e) => setField("interval_months", e.target.value)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
          <input
            type="checkbox"
            className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
            checked={v.auto_renew}
            onChange={(e) => setField("auto_renew", e.target.checked)}
          />
          {t("form.autoRenew")}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="sk-label">{t("form.amount")}</label>
          <input
            className="sk-input"
            value={v.amount_original}
            onChange={(e) => setField("amount_original", e.target.value)}
            inputMode="decimal"
            required
          />
        </div>
        <div>
          <label className="sk-label">{t("form.currency")}</label>
          <select
            className="sk-select"
            required
            value={v.currency_code}
            onChange={(e) => setField("currency_code", e.target.value.toUpperCase())}
          >
            <option value="">{t("form.selectCurrency")}</option>
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
                {c.orphan ? ` — ${t("form.currencyNotInList")}` : ""}
              </option>
            ))}
          </select>
          {currencies.length === 0 ? (
            <p className="mt-2 text-sm text-cream-600">{t("form.noCurrenciesHint")}</p>
          ) : null}
        </div>
      </div>

      {showFxQarCard ? (
        <div className="sk-card space-y-3">
          <p className="text-sm font-medium text-cream-700">{t("list.qar")}</p>
          <p className="text-xl font-semibold text-sage-800">
            {qarPreview.qar != null ? qarPreview.qar.toFixed(2) : "—"}
          </p>
          {!fx.hasLiveFxCache ? (
            <p className="text-xs text-cream-600">{t("fx.builtinHint")}</p>
          ) : null}
          {qarPreview.error ? <p className="text-sm text-red-900">{qarPreview.error}</p> : null}
          <button type="button" className="sk-btn-secondary w-full sm:w-auto" onClick={() => void onFetchFx()}>
            {t("form.recalcFx")}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="sk-label">{t("form.startDate")}</label>
          <input
            type="date"
            className="sk-input"
            value={v.start_date}
            onChange={(e) => setField("start_date", e.target.value)}
          />
        </div>
        <div>
          <label className="sk-label">{t("form.nextDue")}</label>
          <input
            type="date"
            className="sk-input"
            value={v.next_due_date}
            onChange={(e) => setField("next_due_date", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="sk-label">{t("form.endDate")}</label>
          <input
            type="date"
            className="sk-input"
            value={v.end_date}
            onChange={(e) => setField("end_date", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-cream-400/80 pt-6 sm:flex-row sm:flex-wrap">
        <button type="submit" disabled={busy} className="sk-btn-primary sm:min-w-[8rem]">
          {submitLabel ?? t("common.save")}
        </button>
        <button type="button" onClick={onCancel} className="sk-btn-secondary">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
