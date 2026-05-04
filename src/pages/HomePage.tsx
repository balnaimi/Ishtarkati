import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loadSubscriptions,
  loadCategories,
  type SubscriptionListRow,
} from "../db/repo";
import { useFxManager } from "../hooks/useFx";

export function HomePage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<SubscriptionListRow[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [catFilter, setCatFilter] = useState<string>("");
  const [curFilter, setCurFilter] = useState<string>("");
  const [dueSoon, setDueSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { hydrate, fx, refresh } = useFxManager();

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

  useEffect(() => {
    if (!fx.usdRates) {
      void refresh().catch(() => {
        /* user may work offline */
      });
    }
  }, [fx.usdRates, refresh]);

  const currencies = Array.from(new Set(items.map((s) => s.currency_code))).sort();

  function billingLabel(model: string) {
    if (model === "one_time") return t("billing.one_time");
    if (model === "recurring") return t("billing.recurring");
    return t("billing.pay_as_needed");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">{t("list.title")}</h2>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
        <div className="grid gap-1">
          <label className="text-xs text-slate-400">{t("list.filterCategory")}</label>
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
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
        <div className="grid gap-1">
          <label className="text-xs text-slate-400">{t("list.filterCurrency")}</label>
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
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
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={dueSoon} onChange={(e) => setDueSoon(e.target.checked)} />
          {t("list.dueSoon")}
        </label>
        <div className="grid min-w-[180px] flex-1 gap-1">
          <label className="text-xs text-slate-400">{t("common.search")}</label>
          <input
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="…"
          />
        </div>
        <button
          type="button"
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
          onClick={() => void reload()}
        >
          {t("list.title")}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-slate-400">{t("list.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">{t("list.name")}</th>
                <th className="px-3 py-2 font-medium">{t("list.category")}</th>
                <th className="px-3 py-2 font-medium">{t("list.billing")}</th>
                <th className="px-3 py-2 font-medium">{t("list.nextDue")}</th>
                <th className="px-3 py-2 font-medium">{t("list.amount")}</th>
                <th className="px-3 py-2 font-medium">{t("list.qar")}</th>
                <th className="px-3 py-2 font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-900/40">
                  <td className="px-3 py-2">
                    <Link to={`/sub/${s.id}`} className="font-medium text-emerald-400 hover:underline">
                      {s.title}
                    </Link>
                    {s.is_domain ? (
                      <span className="ms-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
                        {t("list.domain")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{s.category_name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{billingLabel(s.billing_model)}</td>
                  <td className="px-3 py-2 text-slate-300">{s.next_due_date ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {s.amount_original} {s.currency_code}
                  </td>
                  <td className="px-3 py-2 text-emerald-300/90">
                    {s.amount_qar_snapshot != null ? s.amount_qar_snapshot.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/sub/${s.id}/edit`} className="text-sky-400 hover:underline">
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
