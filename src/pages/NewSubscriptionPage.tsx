import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SubscriptionForm } from "../components/SubscriptionForm";
import { useFxManager } from "../hooks/useFx";
import {
  getPrimaryCurrencyCode,
  insertSubscription,
  loadCategories,
  loadCreditCards,
  loadWalletMethods,
} from "../db/repo";
import { defaultFormValues, defaultFreeAccountFormValues, formToRow } from "../lib/formMappers";
import type { SubscriptionFormValues } from "../types";

const SETTINGS_PAYMENTS_HREF = "/settings?tab=payments";

type NewKind = "paid" | "account";

export function NewSubscriptionPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const { fx, hydrate, refresh } = useFxManager();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");
  const [paymentMethodCount, setPaymentMethodCount] = useState<number | null>(null);
  const [kind, setKind] = useState<NewKind>(() =>
    new URLSearchParams(location.search).get("kind") === "account" ? "account" : "paid",
  );

  const initial = useMemo(
    () => (kind === "account" ? defaultFreeAccountFormValues(primaryCode) : defaultFormValues()),
    [kind, primaryCode],
  );

  const reloadMeta = useCallback(async () => {
    const cats = await loadCategories();
    setCategories(cats);
  }, []);

  const reloadPaymentMethods = useCallback(async () => {
    const [w, c] = await Promise.all([loadWalletMethods(), loadCreditCards()]);
    setPaymentMethodCount(w.length + c.length);
  }, []);

  useEffect(() => {
    void hydrate();
    void reloadMeta();
    void getPrimaryCurrencyCode().then(setPrimaryCode);
  }, [hydrate, reloadMeta]);

  useEffect(() => {
    void reloadPaymentMethods();
  }, [reloadPaymentMethods, location.pathname, location.key]);

  async function onSubmit(
    values: SubscriptionFormValues,
    info: { primary: number; fxFactor: number; fxAt: string },
  ) {
    const row = formToRow(values, info.primary, info.fxFactor, info.fxAt, null);
    const id = await insertSubscription(row);
    nav(values.billing_model === "free_account" ? `/sub/${id}` : `/sub/${id}`);
  }

  const blocked = kind === "paid" && paymentMethodCount === 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cream-900">{t("form.newTitle")}</h2>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            kind === "paid"
              ? "bg-cream-800 text-cream-50"
              : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
          }`}
          onClick={() => setKind("paid")}
        >
          {t("form.newKindPaid")}
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            kind === "account"
              ? "bg-cream-800 text-cream-50"
              : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
          }`}
          onClick={() => setKind("account")}
        >
          {t("form.newKindAccount")}
        </button>
      </div>
      <p className="text-sm text-cream-700">
        {kind === "account" ? t("form.newKindAccountHint") : t("form.newKindPaidHint")}
      </p>

      {paymentMethodCount === null ? (
        <p className="sk-text-hint text-sm">{t("common.loading")}</p>
      ) : blocked ? (
        <div className="sk-banner-warn-card">
          <p className="text-base font-semibold text-cream-950">{t("form.needsPaymentMethodTitle")}</p>
          <p className="sk-text-hint text-sm leading-relaxed">{t("form.needsPaymentMethodBody")}</p>
          <button
            type="button"
            className="sk-btn-primary"
            onClick={() => nav(SETTINGS_PAYMENTS_HREF)}
          >
            {t("form.goAddPaymentMethod")}
          </button>
        </div>
      ) : (
        <SubscriptionForm
          key={kind === "account" ? `new-account-${primaryCode}` : "new-paid"}
          initial={initial}
          categories={categories}
          primaryCurrencyCode={primaryCode}
          fx={fx}
          onFetchFx={() => refresh()}
          onMetaUpdated={reloadMeta}
          onSubmit={onSubmit}
          onCancel={() => nav(kind === "account" ? "/accounts" : "/")}
        />
      )}
    </div>
  );
}
