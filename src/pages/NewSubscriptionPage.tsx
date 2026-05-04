import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SubscriptionForm } from "../components/SubscriptionForm";
import { useFxManager } from "../hooks/useFx";
import { loadCategories, insertSubscription } from "../db/repo";
import { defaultFormValues, formToRow } from "../lib/formMappers";
import type { SubscriptionFormValues } from "../types";

export function NewSubscriptionPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { fx, hydrate, refresh } = useFxManager();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    void hydrate();
    void loadCategories().then(setCategories);
  }, [hydrate]);

  useEffect(() => {
    if (!fx.usdRates) {
      void refresh().catch(() => {});
    }
  }, [fx.usdRates, refresh]);

  async function onSubmit(values: SubscriptionFormValues, qar: { qar: number; fxFactor: number; fxAt: string }) {
    const row = formToRow(values, qar.qar, qar.fxFactor, qar.fxAt);
    const id = await insertSubscription(row);
    nav(`/sub/${id}`);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">{t("form.newTitle")}</h2>
      <SubscriptionForm
        initial={defaultFormValues()}
        categories={categories}
        fx={fx}
        onFetchFx={() => refresh()}
        onSubmit={onSubmit}
        onCancel={() => nav("/")}
      />
    </div>
  );
}
