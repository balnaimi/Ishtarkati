import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SubscriptionForm } from "../components/SubscriptionForm";
import { useFxManager } from "../hooks/useFx";
import {
  getPrimaryCurrencyCode,
  getSubscription,
  loadCategories,
  updateSubscription,
} from "../db/repo";
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
  const [primaryCode, setPrimaryCode] = useState("QAR");
  const [initial, setInitial] = useState<SubscriptionFormValues | null>(null);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [cancelledAt, setCancelledAt] = useState<string | null>(null);

  const reloadMeta = useCallback(async () => {
    const cats = await loadCategories();
    setCategories(cats);
  }, []);

  useEffect(() => {
    void hydrate();
    void reloadMeta();
    void getPrimaryCurrencyCode().then(setPrimaryCode);
  }, [hydrate, reloadMeta]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const sid = parseInt(id, 10);
      const sub = await getSubscription(sid);
      if (sub) {
        setInitial(subscriptionToForm(sub));
        setExistingId(sub.id);
        setCancelledAt(sub.cancelled_at);
      } else {
        setInitial(defaultFormValues());
        setExistingId(null);
        setCancelledAt(null);
      }
    })();
  }, [id]);

  async function onSubmit(
    values: SubscriptionFormValues,
    info: { primary: number; fxFactor: number; fxAt: string },
  ) {
    if (!id || existingId == null) return;
    const sub = await getSubscription(parseInt(id, 10));
    const row = formToRow(values, info.primary, info.fxFactor, info.fxAt, sub);
    await updateSubscription(existingId, row);
    nav(`/sub/${id}`);
  }

  if (!initial) {
    return <p className="text-cream-700">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cream-900">{t("form.editTitle")}</h2>
      {cancelledAt ? (
        <div className="sk-callout-muted text-sm">
          <p className="font-medium text-cream-900">{t("form.editCancelledHint", { date: cancelledAt })}</p>
          <p className="mt-1 text-cream-800">{t("form.editCancelledHintBody")}</p>
        </div>
      ) : null}
      <SubscriptionForm
        key={id}
        initial={initial}
        categories={categories}
        primaryCurrencyCode={primaryCode}
        fx={fx}
        onFetchFx={() => refresh()}
        onMetaUpdated={reloadMeta}
        onSubmit={onSubmit}
        onCancel={() => nav(-1)}
      />
    </div>
  );
}
