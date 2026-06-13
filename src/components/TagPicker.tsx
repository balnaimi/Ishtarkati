import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { joinTags, parseTags } from "../lib/tags";

interface TagPickerProps {
  value: string;
  available: { id: number; name: string }[];
  onChange: (value: string) => void;
}

export function TagPicker({ value, available, onChange }: TagPickerProps) {
  const { t } = useTranslation();
  const selected = useMemo(() => parseTags(value), [value]);
  const selectedKeys = useMemo(() => new Set(selected.map((x) => x.toLowerCase())), [selected]);
  const [draft, setDraft] = useState("");

  function toggle(name: string) {
    const key = name.toLowerCase();
    const next = selectedKeys.has(key)
      ? selected.filter((x) => x.toLowerCase() !== key)
      : [...selected, name];
    onChange(joinTags(next) ?? "");
  }

  function addDraft() {
    const name = draft.trim();
    if (!name) return;
    const next = joinTags([...selected, name]) ?? "";
    onChange(next);
    setDraft("");
  }

  return (
    <div className="space-y-3">
      {available.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {available.map((tag) => {
            const active = selectedKeys.has(tag.name.toLowerCase());
            return (
              <button
                key={tag.id}
                type="button"
                className={active ? "dash-chip dash-chip-active" : "dash-chip dash-chip-idle"}
                onClick={() => toggle(tag.name)}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-cream-600">{t("tags.noTagsHint")}</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="sk-label">{t("tags.addToAccount")}</label>
          <input
            className="sk-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("form.tagsPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraft();
              }
            }}
          />
        </div>
        <button type="button" className="sk-btn-secondary shrink-0" onClick={addDraft}>
          {t("tags.add")}
        </button>
      </div>
      {selected.length > 0 ? (
        <p className="text-xs text-cream-600">
          {t("tags.selected")}: {selected.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
