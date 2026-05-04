import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SubscriptionForm } from "../components/SubscriptionForm";
import { useFxManager } from "../hooks/useFx";
import { loadCategories, loadCurrencies, insertSubscription } from "../db/repo";
import { defaultFormValues, formToRow } from "../lib/formMappers";
import type { SubscriptionFormValues } from "../types";

export function NewSubscriptionPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { fx, hydrate, refresh } = useFxManager();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string }[]>([]);

  const reloadMeta = useCallback(async () => {
    const [cats, curs] = await Promise.all([loadCategories(), loadCurrencies()]);
    setCategories(cats);
    setCurrencies(curs);
  }, []);

  useEffect(() => {
    void hydrate();
    void reloadMeta();
  }, [hydrate, reloadMeta]);

  async function onSubmit(values: SubscriptionFormValues, qar: { qar: number; fxFactor: number; fxAt: string }) {
    const row = formToRow(values, qar.qar, qar.fxFactor, qar.fxAt);
    const id = await insertSubscription(row);
    nav(`/sub/${id}`);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cream-900">{t("form.newTitle")}</h2>
      <SubscriptionForm
        initial={defaultFormValues()}
        categories={categories}
        currencies={currencies}
        fx={fx}
        onFetchFx={() => refresh()}
        onMetaUpdated={reloadMeta}
        onSubmit={onSubmit}
        onCancel={() => nav("/")}
      />
    </div>
  );
}
