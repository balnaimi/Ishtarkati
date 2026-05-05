import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SubscriptionForm } from "../components/SubscriptionForm";
import { useFxManager } from "../hooks/useFx";
import {
  getPrimaryCurrencyCode,
  insertSubscription,
  loadCategories,
  loadWalletMethods,
} from "../db/repo";
import { defaultFormValues, formToRow } from "../lib/formMappers";
import type { SubscriptionFormValues } from "../types";

export function NewSubscriptionPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const { fx, hydrate, refresh } = useFxManager();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");
  const [walletCount, setWalletCount] = useState<number | null>(null);
  const initial = useMemo(() => defaultFormValues(), []);

  const reloadMeta = useCallback(async () => {
    const cats = await loadCategories();
    setCategories(cats);
  }, []);

  const reloadWallets = useCallback(async () => {
    const w = await loadWalletMethods();
    setWalletCount(w.length);
  }, []);

  useEffect(() => {
    void hydrate();
    void reloadMeta();
    void getPrimaryCurrencyCode().then(setPrimaryCode);
  }, [hydrate, reloadMeta]);

  useEffect(() => {
    void reloadWallets();
  }, [reloadWallets, location.pathname, location.key]);

  async function onSubmit(
    values: SubscriptionFormValues,
    info: { primary: number; fxFactor: number; fxAt: string },
  ) {
    const row = formToRow(values, info.primary, info.fxFactor, info.fxAt, null);
    const id = await insertSubscription(row);
    nav(`/sub/${id}`);
  }

  const blocked = walletCount === 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cream-900">{t("form.newTitle")}</h2>
      {walletCount === null ? (
        <p className="text-sm text-cream-700">{t("common.loading")}</p>
      ) : blocked ? (
        <div className="sk-card space-y-4 border-amber-300/80 bg-amber-50/90">
          <p className="text-base font-semibold text-cream-900">{t("form.needsPaymentMethodTitle")}</p>
          <p className="text-sm leading-relaxed text-cream-800">{t("form.needsPaymentMethodBody")}</p>
          <button
            type="button"
            className="sk-btn-primary"
            onClick={() => nav("/settings?tab=payments")}
          >
            {t("form.goAddPaymentMethod")}
          </button>
        </div>
      ) : (
        <SubscriptionForm
          key="new-subscription"
          initial={initial}
          categories={categories}
          primaryCurrencyCode={primaryCode}
          fx={fx}
          onFetchFx={() => refresh()}
          onMetaUpdated={reloadMeta}
          onSubmit={onSubmit}
          onCancel={() => nav("/")}
        />
      )}
    </div>
  );
}
