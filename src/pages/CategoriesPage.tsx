import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addCategory,
  countActiveSubscriptionsUncategorized,
  deleteCategory,
  loadCategoriesWithActiveCounts,
  updateCategory,
  type CategoryWithActiveCount,
} from "../db/repo";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function CategoriesPage({ omitTitle }: { omitTitle?: boolean } = {}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<CategoryWithActiveCount[]>([]);
  const [uncategorized, setUncategorized] = useState(0);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithActiveCount | null>(null);

  const reload = useCallback(async () => {
    const [cats, uncat] = await Promise.all([
      loadCategoriesWithActiveCounts(),
      countActiveSubscriptionsUncategorized(),
    ]);
    setItems(cats);
    setUncategorized(uncat);
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

  async function handleDelete(c: CategoryWithActiveCount) {
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

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-cream-900">{t("categories.statsOverview")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-cream-700">{t("categories.statsOverviewHint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="sk-card flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-cream-700">{t("categories.totalCategories")}</p>
            <p className="text-3xl font-semibold tabular-nums text-cream-950">{items.length}</p>
          </div>
          <div className="sk-card flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-cream-700">{t("categories.uncategorizedTitle")}</p>
            <p className="text-3xl font-semibold tabular-nums text-cream-950">{uncategorized}</p>
            <p className="text-xs text-cream-600">{t("categories.uncategorizedHint")}</p>
          </div>
          {items.map((c) => {
            const n = Number(c.activeSubscriptionCount) || 0;
            return (
              <div key={c.id} className="sk-card flex flex-col gap-1 p-4">
                <p className="text-sm font-medium text-cream-800">{c.name}</p>
                <p className="text-3xl font-semibold tabular-nums text-cream-950">{n}</p>
                <p className="text-xs text-cream-600">{t("categories.activeCount", { count: n })}</p>
              </div>
            );
          })}
        </div>
      </section>

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

      <div>
        <h3 className="mb-3 text-base font-semibold text-cream-900">{t("categories.manageSection")}</h3>
        <ul className="space-y-3">
          {items.map((c) => (
            <CategoryRow key={c.id} c={c} onSaved={reload} onDelete={() => void handleDelete(c)} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function CategoryRow({
  c,
  onSaved,
  onDelete,
}: {
  c: CategoryWithActiveCount;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(c.name);
  const n = Number(c.activeSubscriptionCount) || 0;

  useEffect(() => {
    setName(c.name);
  }, [c.id, c.name]);

  async function save() {
    await updateCategory(c.id, name);
    onSaved();
  }

  return (
    <li className="sk-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="min-w-0 flex-1 space-y-2">
        <input
          className="sk-input w-full sm:min-w-[12rem]"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-xs text-cream-600">{t("categories.activeCount", { count: n })}</p>
      </div>
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
