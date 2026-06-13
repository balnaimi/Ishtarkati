import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addTag,
  countActiveSubscriptionsUntagged,
  deleteTag,
  loadTagsWithActiveCounts,
  updateTag,
  type TagWithActiveCount,
} from "../db/repo";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function TagsPage({ omitTitle }: { omitTitle?: boolean } = {}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<TagWithActiveCount[]>([]);
  const [untagged, setUntagged] = useState(0);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TagWithActiveCount | null>(null);

  const reload = useCallback(async () => {
    const [tags, noTags] = await Promise.all([
      loadTagsWithActiveCounts(),
      countActiveSubscriptionsUntagged(),
    ]);
    setItems(tags);
    setUntagged(noTags);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await addTag(name);
    setName("");
    void reload();
  }

  async function confirmDeleteTag() {
    if (!deleteTarget) return;
    await deleteTag(deleteTarget.id);
    setDeleteTarget(null);
    void reload();
  }

  return (
    <div className="space-y-8">
      <ConfirmDialog
        open={deleteTarget != null}
        title={t("confirmDialog.deleteTitle")}
        message={t("tags.confirmDelete")}
        variant="danger"
        confirmLabel={t("common.delete")}
        onConfirm={() => void confirmDeleteTag()}
        onCancel={() => setDeleteTarget(null)}
      />
      {omitTitle ? null : (
        <h2 className="text-xl font-semibold text-cream-900">{t("tags.title")}</h2>
      )}

      <p className="text-sm leading-relaxed text-cream-700">{t("tags.intro")}</p>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-cream-900">{t("tags.statsOverview")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-cream-700">{t("tags.statsOverviewHint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="sk-card flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-cream-700">{t("tags.totalTags")}</p>
            <p className="text-3xl font-semibold tabular-nums text-cream-950">{items.length}</p>
          </div>
          <div className="sk-card flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-cream-700">{t("tags.untaggedTitle")}</p>
            <p className="text-3xl font-semibold tabular-nums text-cream-950">{untagged}</p>
            <p className="text-xs text-cream-600">{t("tags.untaggedHint")}</p>
          </div>
          {items.map((tag) => {
            const n = Number(tag.activeSubscriptionCount) || 0;
            return (
              <div key={tag.id} className="sk-card flex flex-col gap-1 p-4">
                <p className="text-sm font-medium text-cream-800">{tag.name}</p>
                <p className="text-3xl font-semibold tabular-nums text-cream-950">{n}</p>
                <p className="text-xs text-cream-600">{t("tags.activeCount", { count: n })}</p>
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
          <label className="sk-label">{t("tags.name")}</label>
          <input className="sk-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className="sk-btn-primary w-full sm:w-auto">
          {t("tags.add")}
        </button>
      </form>

      <div>
        <h3 className="mb-3 text-base font-semibold text-cream-900">{t("tags.manageSection")}</h3>
        <ul className="space-y-3">
          {items.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              onSaved={reload}
              onDelete={() => setDeleteTarget(tag)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function TagRow({
  tag,
  onSaved,
  onDelete,
}: {
  tag: TagWithActiveCount;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(tag.name);
  const n = Number(tag.activeSubscriptionCount) || 0;

  useEffect(() => {
    setName(tag.name);
  }, [tag.id, tag.name]);

  async function save() {
    await updateTag(tag.id, name);
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
        <p className="text-xs text-cream-600">{t("tags.activeCount", { count: n })}</p>
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
