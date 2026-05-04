import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getSetting,
  setSetting,
  loadSubscriptions,
  loadCurrencies,
  addCurrency,
  updateCurrencySort,
  deleteCurrency,
  type AppCurrency,
} from "../db/repo";
import { downloadSubscriptionsCsv, downloadSubscriptionsIcs } from "../lib/tableExport";
import { useFxManager } from "../hooks/useFx";
import { APP_VERSION } from "../version";

const OVERRIDES_KEY = "fx_overrides_json";
const CACHE_KEY = "fx_rates_cache";

export function SettingsPage() {
  const { t } = useTranslation();
  const [overridesText, setOverridesText] = useState("{}");
  const [fxAt, setFxAt] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [fxMsg, setFxMsg] = useState<string | null>(null);
  const [fxBusy, setFxBusy] = useState(false);
  const [currencies, setCurrencies] = useState<AppCurrency[]>([]);
  const [newCurCode, setNewCurCode] = useState("");
  const [newCurOrder, setNewCurOrder] = useState("0");
  const [remindersOn, setRemindersOn] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const { hydrate, refresh, fx } = useFxManager();

  const reloadCurrencies = useCallback(async () => {
    setCurrencies(await loadCurrencies());
  }, []);

  const syncFxAt = useCallback(async () => {
    const cache = await getSetting(CACHE_KEY);
    if (!cache) {
      setFxAt(null);
      return;
    }
    try {
      const p = JSON.parse(cache) as { fetchedAt?: string };
      setFxAt(p.fetchedAt ?? null);
    } catch {
      setFxAt(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const raw = await getSetting(OVERRIDES_KEY);
      if (raw) setOverridesText(raw);
      await syncFxAt();
      const rem = await getSetting("reminders_enabled");
      setRemindersOn(rem === "1");
    })();
  }, [syncFxAt]);

  useEffect(() => {
    void hydrate();
    void reloadCurrencies();
  }, [hydrate, reloadCurrencies]);

  async function save() {
    await setSetting(OVERRIDES_KEY, overridesText.trim() || "{}");
    void hydrate();
  }

  async function handleRefreshFx() {
    setFxMsg(null);
    setFxBusy(true);
    try {
      await refresh();
      await syncFxAt();
      setFxMsg(t("fx.updated"));
      void hydrate();
    } catch {
      setFxMsg(t("fx.fetchError"));
    } finally {
      setFxBusy(false);
    }
  }

  async function handleAddCurrency(e: React.FormEvent) {
    e.preventDefault();
    const code = newCurCode.trim().toUpperCase();
    if (!code) return;
    try {
      const ord = parseInt(newCurOrder, 10) || 0;
      await addCurrency(code, ord);
      setNewCurCode("");
      void reloadCurrencies();
    } catch {
      alert(t("settings.currencyDuplicate"));
    }
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

  async function handleExportCsv() {
    setExportBusy(true);
    try {
      const rows = await loadSubscriptions({});
      downloadSubscriptionsCsv(rows, t);
    } finally {
      setExportBusy(false);
    }
  }

  async function handleExportIcs() {
    setExportBusy(true);
    try {
      const rows = await loadSubscriptions({});
      downloadSubscriptionsIcs(rows, t);
    } finally {
      setExportBusy(false);
    }
  }

  async function setRemindersEnabled(on: boolean) {
    await setSetting("reminders_enabled", on ? "1" : "0");
    setRemindersOn(on);
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <h2 className="text-xl font-semibold text-cream-900">{t("settings.title")}</h2>

      <section className="sk-card space-y-4">
        <h3 className="text-base font-semibold text-cream-900">{t("export.csvTitle")}</h3>
        <p className="text-sm text-cream-700">{t("export.csvHint")}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="sk-btn-primary"
            disabled={exportBusy}
            onClick={() => void handleExportCsv()}
          >
            {t("export.csvButton")}
          </button>
          <button
            type="button"
            className="sk-btn-secondary"
            disabled={exportBusy}
            onClick={() => void handleExportIcs()}
          >
            {t("export.icsButton")}
          </button>
        </div>
        <p className="text-xs text-cream-600">{t("export.icsHint")}</p>
      </section>

      <section className="sk-card space-y-3">
        <h3 className="text-base font-semibold text-cream-900">{t("settings.reminders")}</h3>
        <p className="text-sm text-cream-700">{t("settings.remindersHint")}</p>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
          <input
            type="checkbox"
            className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
            checked={remindersOn}
            onChange={(e) => void setRemindersEnabled(e.target.checked)}
          />
          {t("settings.remindersEnable")}
        </label>
      </section>

      <section className="sk-card space-y-4">
        <h3 className="text-base font-semibold text-cream-900">{t("settings.fxSection")}</h3>
        <p className="text-sm leading-relaxed text-cream-700">{t("fx.builtinHint")}</p>
        <p className="text-sm text-cream-700">
          {t("settings.fxCache")}: <span className="font-mono text-cream-900">{fxAt ?? "—"}</span>
        </p>
        {!fx.hasLiveFxCache ? (
          <p className="text-xs text-walnut-600">{t("fx.noLiveCacheYet")}</p>
        ) : null}
        <button
          type="button"
          className="sk-btn-primary"
          disabled={fxBusy}
          onClick={() => void handleRefreshFx()}
        >
          {t("settings.refreshFxButton")}
        </button>
        {fxMsg ? <p className="text-sm text-sage-800">{fxMsg}</p> : null}
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-cream-900">{t("settings.currenciesTitle")}</h3>
        <p className="text-sm text-cream-700">{t("settings.currenciesHint")}</p>

        <form
          onSubmit={handleAddCurrency}
          className="sk-card flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label className="sk-label">{t("settings.currencyCode")}</label>
            <input
              className="sk-input font-mono uppercase"
              value={newCurCode}
              maxLength={8}
              onChange={(e) => setNewCurCode(e.target.value.toUpperCase())}
              placeholder="QAR"
            />
          </div>
          <div className="w-full sm:w-24">
            <label className="sk-label">{t("categories.sort")}</label>
            <input
              type="number"
              className="sk-input"
              value={newCurOrder}
              onChange={(e) => setNewCurOrder(e.target.value)}
            />
          </div>
          <button type="submit" className="sk-btn-primary w-full sm:w-auto">
            {t("settings.addCurrency")}
          </button>
        </form>

        <ul className="space-y-3">
          {currencies.length === 0 ? (
            <li className="text-sm text-cream-600">{t("settings.currenciesEmpty")}</li>
          ) : (
            currencies.map((c) => (
              <CurrencyRow
                key={c.code}
                c={c}
                onSaved={reloadCurrencies}
                onDelete={() => void reloadCurrencies()}
                t={t}
              />
            ))
          )}
        </ul>
      </section>

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
        <h3 className="text-base font-semibold text-cream-900">{t("settings.fxOverrides")}</h3>
        <p className="mb-2 text-xs text-cream-600">{t("settings.fxOverridesHint")}</p>
        <textarea
          className="sk-textarea font-mono text-sm leading-relaxed"
          value={overridesText}
          onChange={(e) => setOverridesText(e.target.value)}
        />
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

function CurrencyRow({
  c,
  onSaved,
  onDelete,
  t,
}: {
  c: AppCurrency;
  onSaved: () => void;
  onDelete: () => void;
  t: (k: string) => string;
}) {
  const [sort, setSort] = useState(String(c.sort_order));

  useEffect(() => {
    setSort(String(c.sort_order));
  }, [c.code, c.sort_order]);

  async function saveSort() {
    await updateCurrencySort(c.code, parseInt(sort, 10) || 0);
    onSaved();
  }

  async function del() {
    if (!confirm(t("settings.confirmDeleteCurrency"))) return;
    try {
      await deleteCurrency(c.code);
      onDelete();
    } catch {
      alert(t("settings.currencyInUse"));
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-cream-400 bg-cream-50/95 p-4 shadow-sm sm:flex-row sm:items-center">
      <span className="min-w-[4rem] font-mono font-semibold text-cream-900">{c.code}</span>
      <input
        type="number"
        className="sk-input w-full sm:w-24"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="sk-btn-secondary text-sm" onClick={() => void saveSort()}>
          {t("common.save")}
        </button>
        <button type="button" className="sk-btn-danger text-sm" onClick={() => void del()}>
          {t("common.delete")}
        </button>
      </div>
    </li>
  );
}
