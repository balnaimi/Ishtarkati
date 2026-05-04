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
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
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

  async function handleExport() {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const r = await window.ishtarkati.backupExport();
      if (r.ok) {
        setBackupMsg(`${t("backup.exportOk")}: ${r.path}`);
      } else if (r.canceled) {
        setBackupMsg(t("backup.canceled"));
      } else {
        setBackupMsg(`${t("backup.error")}${r.error ? ` — ${r.error}` : ""}`);
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleImport() {
    if (!confirm(t("backup.confirmImport"))) return;
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const r = await window.ishtarkati.backupImport();
      if (r.ok) {
        setBackupMsg(t("backup.importOk"));
        window.setTimeout(() => {
          window.location.reload();
        }, 600);
      } else if (r.canceled) {
        setBackupMsg(t("backup.canceled"));
      } else {
        setBackupMsg(`${t("backup.error")}${r.error ? ` — ${r.error}` : ""}`);
      }
    } finally {
      setBackupBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <h2 className="text-xl font-semibold text-cream-900">{t("settings.title")}</h2>

      <section className="sk-card space-y-4">
        <h3 className="text-base font-semibold text-cream-900">{t("backup.title")}</h3>
        <p className="text-sm leading-relaxed text-cream-700">{t("backup.hint")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="sk-btn-primary flex-1"
            disabled={backupBusy}
            onClick={() => void handleExport()}
          >
            {t("backup.export")}
          </button>
          <button
            type="button"
            className="sk-btn-secondary flex-1"
            disabled={backupBusy}
            onClick={() => void handleImport()}
          >
            {t("backup.import")}
          </button>
        </div>
        {backupMsg ? (
          <p className="rounded-lg border border-cream-400 bg-cream-200/60 px-3 py-2 text-sm text-cream-900">
            {backupMsg}
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <p className="text-sm text-cream-700">
          {t("settings.fxCache")}: <span className="font-mono text-cream-900">{fxAt ?? "—"}</span>
        </p>

        <div>
          <label className="sk-label">{t("settings.fxOverrides")}</label>
          <p className="mb-2 text-xs text-cream-600">{t("settings.fxOverridesHint")}</p>
          <textarea
            className="sk-textarea font-mono text-sm leading-relaxed"
            value={overridesText}
            onChange={(e) => setOverridesText(e.target.value)}
          />
        </div>

        <button type="button" className="sk-btn-primary" onClick={() => void save()}>
          {t("settings.saveSettings")}
        </button>
      </section>

      <p className="text-sm text-cream-600">
        {t("settings.version")}: <span className="text-cream-900">{APP_VERSION}</span>
      </p>
    </div>
  );
}
