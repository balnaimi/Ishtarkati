import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addCategory,
  deleteCategory,
  loadCategories,
  updateCategory,
} from "../db/repo";
import type { Category } from "../types";

export function CategoriesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [order, setOrder] = useState("0");

  const reload = useCallback(async () => {
    setItems(await loadCategories());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await addCategory(name, parseInt(order, 10) || 0);
    setName("");
    void reload();
  }

  async function handleDelete(c: Category) {
    if (!confirm(t("categories.confirmDelete"))) return;
    await deleteCategory(c.id);
    void reload();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">{t("categories.title")}</h2>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label className="text-xs text-slate-400">{t("categories.name")}</label>
          <input
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid w-24 gap-1">
          <label className="text-xs text-slate-400">{t("categories.sort")}</label>
          <input
            type="number"
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </div>
        <button type="submit" className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">
          {t("categories.add")}
        </button>
      </form>

      <ul className="space-y-2">
        {items.map((c) => (
          <CategoryRow key={c.id} c={c} onSaved={reload} onDelete={() => void handleDelete(c)} />
        ))}
      </ul>
    </div>
  );
}

function CategoryRow({
  c,
  onSaved,
  onDelete,
}: {
  c: Category;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(c.name);
  const [sort, setSort] = useState(String(c.sort_order));

  useEffect(() => {
    setName(c.name);
    setSort(String(c.sort_order));
  }, [c.id, c.name, c.sort_order]);

  async function save() {
    await updateCategory(c.id, name, parseInt(sort, 10) || 0);
    onSaved();
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
      <input
        className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="number"
        className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      />
      <button type="button" className="text-sm text-emerald-400 hover:underline" onClick={() => void save()}>
        {t("common.save")}
      </button>
      <button type="button" className="text-sm text-red-400 hover:underline" onClick={onDelete}>
        {t("common.delete")}
      </button>
    </li>
  );
}
