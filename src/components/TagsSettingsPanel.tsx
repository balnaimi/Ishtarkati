import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadSubscriptionTagStats, type SubscriptionTagStat } from "../db/repo";

export function TagsSettingsPanel() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SubscriptionTagStat[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadSubscriptionTagStats();
      setRows(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <section className="sk-card space-y-3">
        <h3 className="text-base font-semibold text-cream-900">{t("settings.tagsSectionTitle")}</h3>
        <p className="text-sm leading-relaxed text-cream-700">{t("settings.tagsSectionHint")}</p>
        <button type="button" className="sk-btn-secondary" onClick={() => void reload()}>
          {t("settings.tagsRefresh")}
        </button>
      </section>

      {loading ? (
        <p className="sk-text-hint text-sm">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="sk-callout-muted text-sm">{t("settings.tagsEmpty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={t("settings.tagsListLabel")}>
          {rows.map((r) => (
            <li
              key={r.tag}
              className="inline-flex items-center gap-2 rounded-full border border-cream-400/90 bg-cream-100/70 px-3 py-1.5 text-sm text-cream-900 shadow-sm"
            >
              <span className="font-medium">{r.tag}</span>
              <span className="text-xs tabular-nums text-cream-600">
                {t("settings.tagsUseCount", { count: r.count })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
