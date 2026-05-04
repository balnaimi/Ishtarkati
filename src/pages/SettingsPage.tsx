import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSetting, setSetting } from "../db/repo";
import { useFxManager } from "../hooks/useFx";
import { APP_VERSION } from "../version";

const OVERRIDES_KEY = "fx_overrides_json";

export function SettingsPage() {
  const { t } = useTranslation();
  const [overridesText, setOverridesText] = useState("{}");
  const [fxAt, setFxAt] = useState<string | null>(null);
  const { hydrate } = useFxManager();

  useEffect(() => {
    void (async () => {
      const raw = await getSetting(OVERRIDES_KEY);
      if (raw) setOverridesText(raw);
      const cache = await getSetting("fx_rates_cache");
      if (cache) {
        try {
          const p = JSON.parse(cache) as { fetchedAt?: string };
          setFxAt(p.fetchedAt ?? null);
        } catch {
          setFxAt(null);
        }
      }
    })();
  }, []);

  async function save() {
    await setSetting(OVERRIDES_KEY, overridesText.trim() || "{}");
    void hydrate();
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h2 className="text-xl font-semibold text-white">{t("settings.title")}</h2>

      <p className="text-sm text-slate-400">
        {t("settings.fxCache")}: {fxAt ?? "—"}
      </p>

      <div className="grid gap-2">
        <label className="text-sm text-slate-400">{t("settings.fxOverrides")}</label>
        <p className="text-xs text-slate-500">{t("settings.fxOverridesHint")}</p>
        <textarea
          className="min-h-[120px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm"
          value={overridesText}
          onChange={(e) => setOverridesText(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="rounded-lg bg-emerald-800 px-4 py-2 text-sm text-white hover:bg-emerald-700"
        onClick={() => void save()}
      >
        {t("settings.saveSettings")}
      </button>

      <p className="text-sm text-slate-500">
        {t("settings.version")}: {APP_VERSION}
      </p>
    </div>
  );
}
