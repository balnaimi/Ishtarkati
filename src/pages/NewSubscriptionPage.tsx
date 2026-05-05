import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SubscriptionForm } from "../components/SubscriptionForm";
import { useFxManager } from "../hooks/useFx";
import { getPrimaryCurrencyCode, loadCategories, insertSubscription } from "../db/repo";
import { defaultFormValues, formToRow } from "../lib/formMappers";
import type { SubscriptionFormValues } from "../types";

export function NewSubscriptionPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { fx, hydrate, refresh } = useFxManager();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");
  const initial = useMemo(() => defaultFormValues(), []);

  const reloadMeta = useCallback(async () => {
    const cats = await loadCategories();
    setCategories(cats);
  }, []);

  useEffect(() => {
    void hydrate();
    void reloadMeta();
    void getPrimaryCurrencyCode().then(setPrimaryCode);
  }, [hydrate, reloadMeta]);

  async function onSubmit(
    values: SubscriptionFormValues,
    info: { primary: number; fxFactor: number; fxAt: string },
  ) {
    const row = formToRow(values, info.primary, info.fxFactor, info.fxAt, null);
    const id = await insertSubscription(row);
    nav(`/sub/${id}`);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cream-900">{t("form.newTitle")}</h2>
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
    </div>
  );
}
