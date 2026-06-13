import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { defaultFreeAccountFormValues, formToRow } from "../lib/formMappers";
import type { SubscriptionFormValues } from "../types";

export function NewSubscriptionPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { fx, hydrate, refresh } = useFxManager();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");
  const [paymentMethodCount, setPaymentMethodCount] = useState<number | null>(null);

  const initial = useMemo(() => defaultFreeAccountFormValues(primaryCode), [primaryCode]);

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
    void reloadPaymentMethods();
  }, [hydrate, reloadMeta, reloadPaymentMethods]);

  async function onSubmit(
    values: SubscriptionFormValues,
    info: { primary: number; fxFactor: number; fxAt: string },
  ) {
    const row = formToRow(values, info.primary, info.fxFactor, info.fxAt, null);
    const id = await insertSubscription(row);
    nav(`/sub/${id}`);
  }

  return (
    <div className="dash-page">
      <header>
        <h1 className="dash-page-title">{t("form.newTitle")}</h1>
        <p className="dash-page-sub">{t("form.newUnifiedHint")}</p>
      </header>

      {paymentMethodCount === null ? (
        <p className="sk-text-hint text-sm">{t("common.loading")}</p>
      ) : (
        <SubscriptionForm
          key={`new-account-${primaryCode}`}
          initial={initial}
          categories={categories}
          primaryCurrencyCode={primaryCode}
          fx={fx}
          onFetchFx={() => refresh()}
          onMetaUpdated={reloadMeta}
          onSubmit={onSubmit}
          onCancel={() => nav("/accounts")}
          paymentMethodCount={paymentMethodCount}
          blockPaidWithoutMethods
        />
      )}
    </div>
  );
}
