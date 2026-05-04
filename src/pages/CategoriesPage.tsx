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
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-cream-900">{t("categories.title")}</h2>

      <form
        onSubmit={handleAdd}
        className="sk-card flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label className="sk-label">{t("categories.name")}</label>
          <input className="sk-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-full sm:w-28">
          <label className="sk-label">{t("categories.sort")}</label>
          <input
            type="number"
            className="sk-input"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </div>
        <button type="submit" className="sk-btn-primary w-full sm:w-auto">
          {t("categories.add")}
        </button>
      </form>

      <ul className="space-y-3">
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
    <li className="flex flex-col gap-3 rounded-xl border border-cream-400 bg-cream-50/95 p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
      <input
        className="sk-input min-w-0 flex-1 sm:min-w-[12rem]"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="number"
        className="sk-input w-full sm:w-24"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="sk-btn-secondary text-sm" onClick={() => void save()}>
          {t("common.save")}
        </button>
        <button type="button" className="sk-btn-danger text-sm" onClick={onDelete}>
          {t("common.delete")}
        </button>
      </div>
    </li>
  );
}
