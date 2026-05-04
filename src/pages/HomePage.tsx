import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loadSubscriptions,
  loadCategories,
  type SubscriptionListRow,
} from "../db/repo";
import { useFxManager } from "../hooks/useFx";
import { DueProgressBar } from "../components/DueProgressBar";

export function HomePage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<SubscriptionListRow[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [catFilter, setCatFilter] = useState<string>("");
  const [curFilter, setCurFilter] = useState<string>("");
  const [dueSoon, setDueSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { hydrate } = useFxManager();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cats] = await Promise.all([
        loadSubscriptions({
          categoryId: catFilter ? parseInt(catFilter, 10) : undefined,
          currency: curFilter || undefined,
          dueWithinDays: dueSoon ? 30 : undefined,
          search: search.trim() || undefined,
        }),
        loadCategories(),
      ]);
      setItems(list);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [catFilter, curFilter, dueSoon, search]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currencies = Array.from(new Set(items.map((s) => s.currency_code))).sort();

  function billingLabel(model: string) {
    if (model === "one_time") return t("billing.one_time");
    if (model === "recurring") return t("billing.recurring");
    return t("billing.pay_as_needed");
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-cream-900">{t("list.title")}</h2>

      <div className="sk-card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <label className="sk-label">{t("list.filterCategory")}</label>
            <select
              className="sk-select"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="sk-label">{t("list.filterCurrency")}</label>
            <select
              className="sk-select"
              value={curFilter}
              onChange={(e) => setCurFilter(e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2.5 lg:col-span-3">
            <input
              type="checkbox"
              id="due-soon"
              className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
              checked={dueSoon}
              onChange={(e) => setDueSoon(e.target.checked)}
            />
            <label htmlFor="due-soon" className="cursor-pointer text-sm text-cream-800">
              {t("list.dueSoon")}
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="sk-label">{t("common.search")}</label>
            <input
              className="sk-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="…"
            />
          </div>
          <div className="flex lg:col-span-1">
            <button type="button" className="sk-btn-secondary w-full lg:w-auto" onClick={() => void reload()}>
              {t("list.applyFilters")}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-cream-700">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-cream-700">{t("list.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cream-400 bg-cream-50/95 shadow-sm">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead className="border-b border-cream-400 bg-cream-200/80 text-cream-800">
              <tr>
                <th className="px-3 py-3 font-semibold">{t("list.name")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.category")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.billing")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.nextDue")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.amount")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.qar")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-cream-300/80 hover:bg-cream-200/40">
                  <td className="px-3 py-3 align-top">
                    <Link
                      to={`/sub/${s.id}`}
                      className="font-medium text-sage-800 underline-offset-2 hover:underline"
                    >
                      {s.title}
                    </Link>
                    {s.is_domain ? (
                      <span className="me-2 mt-1 inline-block sk-chip">{t("list.domain")}</span>
                    ) : null}
                    {s.next_due_date ? (
                      <div className="mt-2">
                        <DueProgressBar
                          sub={{
                            next_due_date: s.next_due_date,
                            start_date: s.start_date,
                            billing_model: s.billing_model,
                            interval_unit: s.interval_unit,
                            interval_months: s.interval_months,
                          }}
                          size="sm"
                          showCaption={false}
                        />
                      </div>
                    ) : (
                      <span className="mt-1 block text-xs text-cream-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-cream-800">{s.category_name ?? "—"}</td>
                  <td className="px-3 py-3 text-cream-800">{billingLabel(s.billing_model)}</td>
                  <td className="px-3 py-3 text-cream-800">{s.next_due_date ?? "—"}</td>
                  <td className="px-3 py-3 text-cream-800">
                    {s.amount_original} {s.currency_code}
                  </td>
                  <td className="px-3 py-3 font-medium text-sage-800">
                    {s.amount_qar_snapshot != null ? s.amount_qar_snapshot.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      to={`/sub/${s.id}/edit`}
                      className="text-walnut-600 underline-offset-2 hover:underline"
                    >
                      {t("common.edit")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
