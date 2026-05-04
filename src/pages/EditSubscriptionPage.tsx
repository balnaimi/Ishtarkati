import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SubscriptionForm } from "../components/SubscriptionForm";
import { useFxManager } from "../hooks/useFx";
import { getSubscription, loadCategories, updateSubscription } from "../db/repo";
import {
  defaultFormValues,
  formToRow,
  subscriptionToForm,
} from "../lib/formMappers";
import type { SubscriptionFormValues } from "../types";

export function EditSubscriptionPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { fx, hydrate, refresh } = useFxManager();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [initial, setInitial] = useState<SubscriptionFormValues | null>(null);

  useEffect(() => {
    void hydrate();
    void loadCategories().then(setCategories);
  }, [hydrate]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const sub = await getSubscription(parseInt(id, 10));
      if (sub) {
        setInitial(subscriptionToForm(sub));
      } else {
        setInitial(defaultFormValues());
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!fx.usdRates) {
      void refresh().catch(() => {});
    }
  }, [fx.usdRates, refresh]);

  async function onSubmit(values: SubscriptionFormValues, qar: { qar: number; fxFactor: number; fxAt: string }) {
    if (!id) return;
    const row = formToRow(values, qar.qar, qar.fxFactor, qar.fxAt);
    await updateSubscription(parseInt(id, 10), row);
    nav(`/sub/${id}`);
  }

  if (!initial) {
    return <p className="text-cream-700">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cream-900">{t("form.editTitle")}</h2>
      <SubscriptionForm
        key={id}
        initial={initial}
        categories={categories}
        fx={fx}
        onFetchFx={() => refresh()}
        onSubmit={onSubmit}
        onCancel={() => nav(-1)}
      />
    </div>
  );
}
