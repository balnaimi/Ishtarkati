import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CreditCard, SubscriptionFormValues, WalletMethod } from "../types";
import { amountToPrimaryFromUsdBase } from "../lib/fx";
import type { FxState } from "../lib/fxState";
import { addCategory, loadCreditCards, loadWalletMethods } from "../db/repo";
import { listCurrenciesSorted, getCurrencyInfo } from "../lib/currenciesData";
import { PAYMENT_SERVICES } from "../lib/paymentCatalog";
import { hostnameFromWebsiteUrl } from "../lib/siteFavicon";
import { SiteFavicon } from "./SiteFavicon";

interface SubscriptionFormProps {
  initial: SubscriptionFormValues;
  categories: { id: number; name: string }[];
  primaryCurrencyCode: string;
  fx: FxState;
  onFetchFx: () => Promise<void>;
  onMetaUpdated: () => Promise<void>;
  onSubmit: (
    values: SubscriptionFormValues,
    primaryInfo: { primary: number; fxFactor: number; fxAt: string },
  ) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function SubscriptionForm({
  initial,
  categories,
  primaryCurrencyCode,
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
  const [wallets, setWallets] = useState<WalletMethod[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);

  useEffect(() => {
    setV(initial);
  }, [initial]);

  useEffect(() => {
    void Promise.all([loadWalletMethods(), loadCreditCards()]).then(([w, c]) => {
      setWallets(w);
      setCards(c);
    });
  }, []);

  const paymentSelectValue =
    v.wallet_method_id.trim() !== ""
      ? `w:${v.wallet_method_id}`
      : v.credit_card_id.trim() !== ""
        ? `c:${v.credit_card_id}`
        : "";

  function onPaymentChange(raw: string) {
    if (!raw) {
      setField("wallet_method_id", "");
      setField("credit_card_id", "");
      return;
    }
    if (raw.startsWith("w:")) {
      setField("wallet_method_id", raw.slice(2));
      setField("credit_card_id", "");
      return;
    }
    if (raw.startsWith("c:")) {
      setField("credit_card_id", raw.slice(2));
      setField("wallet_method_id", "");
    }
  }

  const cur = (v.currency_code || "").trim().toUpperCase();
  const primary = primaryCurrencyCode.trim().toUpperCase();
  const isPrimary = cur === primary;
  const showFxPrimaryCard = cur.length > 0 && !isPrimary;
  const currencyOptions = useMemo(() => listCurrenciesSorted(), []);

  const primaryPreview = useMemo(() => {
    const amt = parseFloat(v.amount_original.replace(",", "."));
    if (Number.isNaN(amt)) {
      return {
        primary: null as number | null,
        fxFactor: null as number | null,
        error: null as string | null,
      };
    }
    if (isPrimary) {
      return { primary: amt, fxFactor: 1, error: null as string | null };
    }
    if (!cur) {
      return {
        primary: null,
        fxFactor: null,
        error: null as string | null,
      };
    }
    try {
      const { primary: pr, fxFactor } = amountToPrimaryFromUsdBase(
        amt,
        cur,
        primary,
        fx.usdRates,
        fx.overrides,
      );
      return { primary: pr, fxFactor, error: null as string | null };
    } catch {
      return {
        primary: null,
        fxFactor: null,
        error: t("fx.rateMissingHint"),
      };
    }
  }, [v.amount_original, cur, isPrimary, primary, fx.usdRates, fx.overrides, t]);

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
      const newId = await addCategory(name);
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
      const cnt = parseInt(v.interval_count, 10);
      if (Number.isNaN(cnt) || cnt < 1) {
        setErr(t("form.invalidNumber"));
        return;
      }
      if (!v.start_date.trim()) {
        setErr(t("form.recurringStartRequired"));
        return;
      }
    }
    if (v.billing_model === "one_time" && !v.start_date.trim()) {
      setErr(t("form.oneTimePaidDateRequired"));
      return;
    }

    let pr: number;
    let fxFactor: number;
    let fxAt: string;
    if (isPrimary) {
      pr = amt;
      fxFactor = 1;
      fxAt = new Date().toISOString();
    } else {
      if (primaryPreview.primary == null || primaryPreview.fxFactor == null) {
        setErr(primaryPreview.error ?? t("fx.fetchError"));
        return;
      }
      pr = primaryPreview.primary;
      fxFactor = primaryPreview.fxFactor;
      fxAt = fx.fetchedAt ?? new Date().toISOString();
    }

    setBusy(true);
    try {
      await onSubmit(v, { primary: pr, fxFactor, fxAt });
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    } finally {
      setBusy(false);
    }
  }

  const primaryMeta = getCurrencyInfo(primary);
  const websiteHost = useMemo(() => hostnameFromWebsiteUrl(v.website_url), [v.website_url]);

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
          placeholder="https://"
        />
        {websiteHost ? (
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-cream-400/90 bg-cream-100/60 px-3 py-2">
            <SiteFavicon websiteUrl={v.website_url} size="md" />
            <span dir="ltr" className="min-w-0 truncate text-xs text-cream-700">{websiteHost}</span>
          </div>
        ) : (
          <p className="mt-1 text-xs text-cream-600">{t("form.websiteFaviconHint")}</p>
        )}
      </div>

      <div>
        <label className="sk-label">{t("form.tags")}</label>
        <input
          className="sk-input"
          value={v.tags}
          onChange={(e) => setField("tags", e.target.value)}
          placeholder={t("form.tagsPlaceholder")}
        />
        <p className="mt-1.5 text-xs text-cream-600">{t("form.tagsHint")}</p>
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

      <div>
        <label className="sk-label">{t("form.paymentMethod")}</label>
        <select
          className="sk-select"
          value={paymentSelectValue}
          onChange={(e) => onPaymentChange(e.target.value)}
        >
          <option value="">{t("common.none")}</option>
          <optgroup label={t("form.paymentOptgroupServices")}>
            {wallets.map((w) => (
              <option key={`w-${w.id}`} value={`w:${w.id}`}>
                {PAYMENT_SERVICES.find((s) => s.code === w.service_code)?.nameAr ?? w.service_code} ·{" "}
                {w.account_text.slice(0, 24)}
                {w.account_text.length > 24 ? "…" : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("form.paymentOptgroupCards")}>
            {cards.map((c) => (
              <option key={`c-${c.id}`} value={`c:${c.id}`}>
                {c.brand} ·••• {c.last4} ({t("payment.expiresShort", { m: c.exp_month, y: c.exp_year })})
              </option>
            ))}
          </optgroup>
        </select>
        <p className="mt-1 text-xs text-cream-600">{t("form.paymentMethodHint")}</p>
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
        </select>
      </div>

      {v.billing_model === "recurring" ? (
        <div className="space-y-5 border-t border-cream-400/80 pt-5">
          <div>
            <label className="sk-label">{t("form.interval")}</label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <select
                className="sk-select min-w-[8rem] flex-1"
                value={v.interval_unit}
                onChange={(e) =>
                  setField("interval_unit", e.target.value as SubscriptionFormValues["interval_unit"])
                }
              >
                <option value="">—</option>
                <option value="day">{t("interval.day")}</option>
                <option value="week">{t("interval.week")}</option>
                <option value="month">{t("interval.month")}</option>
                <option value="year">{t("interval.year")}</option>
              </select>
              <div className="min-w-0 flex-1">
                <label className="sk-label">{t("form.intervalCount")}</label>
                <input
                  type="number"
                  min={1}
                  className="sk-input max-w-xs"
                  value={v.interval_count}
                  onChange={(e) => setField("interval_count", e.target.value)}
                />
              </div>
            </div>
          </div>
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
                {c.flag} {c.code} — {c.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showFxPrimaryCard ? (
        <div className="sk-card space-y-3">
          <p className="text-sm font-medium text-cream-700">
            {t("form.approxPrimary", { code: primary, label: primaryMeta.nameAr })}
          </p>
          <p className="text-xl font-semibold text-sage-800">
            {primaryPreview.primary != null ? primaryPreview.primary.toFixed(2) : "—"}
          </p>
          {!fx.hasLiveFxCache ? (
            <p className="text-xs text-cream-600">{t("fx.builtinHint")}</p>
          ) : null}
          {primaryPreview.error ? (
            <p className="text-sm text-red-900">{primaryPreview.error}</p>
          ) : null}
          <button type="button" className="sk-btn-secondary w-full sm:w-auto" onClick={() => void onFetchFx()}>
            {t("form.recalcFx")}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="sk-label">
            {v.billing_model === "one_time" ? t("form.paidDate") : t("form.startDate")}
          </label>
          <input
            type="date"
            className="sk-input"
            value={v.start_date}
            onChange={(e) => setField("start_date", e.target.value)}
          />
        </div>
        {v.billing_model === "one_time" ? (
          <div>
            <label className="sk-label">{t("form.nextDueOptional")}</label>
            <input
              type="date"
              className="sk-input"
              value={v.next_due_date}
              onChange={(e) => setField("next_due_date", e.target.value)}
            />
          </div>
        ) : null}
        <div className="sm:col-span-2">
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
