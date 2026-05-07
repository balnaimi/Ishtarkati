import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addCategory,
  deleteCategory,
  loadCategories,
  updateCategory,
} from "../db/repo";
import type { Category } from "../types";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function CategoriesPage({ omitTitle }: { omitTitle?: boolean } = {}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const reload = useCallback(async () => {
    setItems(await loadCategories());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await addCategory(name);
    setName("");
    void reload();
  }

  async function confirmDeleteCategory() {
    if (!deleteTarget) return;
    await deleteCategory(deleteTarget.id);
    setDeleteTarget(null);
    void reload();
  }

  async function handleDelete(c: Category) {
    setDeleteTarget(c);
  }

  return (
    <div className="space-y-8">
      <ConfirmDialog
        open={deleteTarget != null}
        title={t("confirmDialog.deleteTitle")}
        message={t("categories.confirmDelete")}
        variant="danger"
        confirmLabel={t("common.delete")}
        onConfirm={() => void confirmDeleteCategory()}
        onCancel={() => setDeleteTarget(null)}
      />
      {omitTitle ? null : (
        <h2 className="text-xl font-semibold text-cream-900">{t("categories.title")}</h2>
      )}

      <form
        onSubmit={handleAdd}
        className="sk-card flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label className="sk-label">{t("categories.name")}</label>
          <input className="sk-input" value={name} onChange={(e) => setName(e.target.value)} />
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

  useEffect(() => {
    setName(c.name);
  }, [c.id, c.name]);

  async function save() {
    await updateCategory(c.id, name);
    onSaved();
  }

  return (
    <li className="sk-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
      <input
        className="sk-input min-w-0 flex-1 sm:min-w-[12rem]"
        value={name}
        onChange={(e) => setName(e.target.value)}
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
