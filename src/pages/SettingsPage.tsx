import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getPrimaryCurrencyCode,
  getSetting,
  loadSubscriptions,
  PIN_ENABLED_KEY,
  PRIMARY_CURRENCY_KEY,
  setSetting,
} from "../db/repo";
import { downloadSubscriptionsCsv, downloadSubscriptionsIcs } from "../lib/tableExport";
import { useFxManager } from "../hooks/useFx";
import { APP_VERSION } from "../version";
import { CategoriesPage } from "./CategoriesPage";
import { PaymentMethodsPanel } from "../components/PaymentMethodsPanel";
import { listCurrenciesSorted } from "../lib/currenciesData";

const OVERRIDES_KEY = "fx_overrides_json";
const CACHE_KEY = "fx_rates_cache";

type TabId = "app" | "categories" | "payments" | "export" | "danger";

export function SettingsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>("app");
  const [overridesText, setOverridesText] = useState("{}");
  const [fxAt, setFxAt] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [fxMsg, setFxMsg] = useState<string | null>(null);
  const [fxErrDetail, setFxErrDetail] = useState<string | null>(null);
  const [fxBusy, setFxBusy] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [primaryCurrency, setPrimaryCurrency] = useState("QAR");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);
  const [dangerStep, setDangerStep] = useState<0 | 1>(0);
  const [dangerCode, setDangerCode] = useState("");
  const [dangerTyped, setDangerTyped] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerMsg, setDangerMsg] = useState<string | null>(null);
  const { hydrate, refresh, fx } = useFxManager();

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
      const prim = await getPrimaryCurrencyCode();
      setPrimaryCurrency(prim);
      const pe = await getSetting(PIN_ENABLED_KEY);
      setPinEnabled(pe === "1");
    })();
  }, [syncFxAt]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (tab !== "danger") {
      setDangerStep(0);
      setDangerCode("");
      setDangerTyped("");
      setDangerMsg(null);
    }
  }, [tab]);

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw === "categories" || raw === "payments" || raw === "export" || raw === "danger") {
      setTab(raw);
    } else {
      setTab("app");
    }
  }, [searchParams]);

  function selectTab(id: TabId) {
    setTab(id);
    if (id === "app") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: id }, { replace: true });
    }
  }

  async function saveOverrides() {
    await setSetting(OVERRIDES_KEY, overridesText.trim() || "{}");
    void hydrate();
  }

  async function handleRefreshFx() {
    setFxMsg(null);
    setFxErrDetail(null);
    setFxBusy(true);
    try {
      await refresh();
      await syncFxAt();
      setFxMsg(t("fx.updated"));
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setFxErrDetail(detail);
      setFxMsg(t("fx.fetchError"));
    } finally {
      setFxBusy(false);
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

  async function setRemindersEnabled(on: boolean) {
    await setSetting("reminders_enabled", on ? "1" : "0");
    setRemindersOn(on);
  }

  async function savePrimary(code: string) {
    await setSetting(PRIMARY_CURRENCY_KEY, code.trim().toUpperCase());
    setPrimaryCurrency(code.trim().toUpperCase());
  }

  async function testNotify() {
    await window.ishtarkati.showNotification({
      title: t("notify.digestTitle"),
      body: t("settings.testNotifyBody"),
    });
  }

  async function applyPinSettings() {
    setPinFeedback(null);
    setPinBusy(true);
    try {
      if (!pinEnabled) {
        await window.ishtarkati.clearPin();
        await setSetting(PIN_ENABLED_KEY, "0");
        setPinFeedback(t("pin.disabledOk"));
        setPin1("");
        setPin2("");
        return;
      }
      if (pin1.length < 4) {
        setPinFeedback(t("pin.tooShort"));
        return;
      }
      if (pin1 !== pin2) {
        setPinFeedback(t("pin.mismatch"));
        return;
      }
      const r = await window.ishtarkati.setPin(pin1);
      if (!r.ok) {
        setPinFeedback(t("pin.setFailed"));
        return;
      }
      await setSetting(PIN_ENABLED_KEY, "1");
      setPinFeedback(t("pin.enabledOk"));
      setPin1("");
      setPin2("");
    } finally {
      setPinBusy(false);
    }
  }

  function revealDangerCode() {
    setDangerMsg(null);
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const code = String(100000 + (Number(arr[0]) % 900000));
    setDangerCode(code);
    setDangerTyped("");
    setDangerStep(1);
  }

  async function executeDangerReset() {
    setDangerMsg(null);
    if (dangerTyped.trim() !== dangerCode) {
      setDangerMsg(t("settings.dangerResetCodeMismatch"));
      return;
    }
    setDangerBusy(true);
    try {
      const r = await window.ishtarkati.resetLocalDatabase();
      if (r.ok) {
        window.location.reload();
      } else {
        setDangerMsg(`${t("settings.dangerResetFailed")}${r.error ? ` — ${r.error}` : ""}`);
      }
    } finally {
      setDangerBusy(false);
    }
  }

  function cancelDangerReset() {
    setDangerStep(0);
    setDangerCode("");
    setDangerTyped("");
    setDangerMsg(null);
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "app", label: t("settings.tabApp") },
    { id: "categories", label: t("settings.tabCategories") },
    { id: "payments", label: t("settings.tabPayments") },
    { id: "export", label: t("settings.tabExport") },
    { id: "danger", label: t("settings.tabDanger") },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold text-cream-900">{t("settings.title")}</h2>

      <div className="flex flex-wrap gap-2 border-b border-cream-400 pb-3">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === x.id ? "bg-cream-800 text-cream-50" : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
            }`}
            onClick={() => selectTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === "app" ? (
        <div className="space-y-8">
          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.primaryCurrencyTitle")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("settings.primaryCurrencyHint")}</p>
            <select
              className="sk-select"
              value={primaryCurrency}
              onChange={(e) => void savePrimary(e.target.value)}
            >
              {listCurrenciesSorted().map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.nameAr}
                </option>
              ))}
            </select>
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
            <button type="button" className="sk-btn-secondary" onClick={() => void testNotify()}>
              {t("settings.testNotify")}
            </button>
          </section>

          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.pinSection")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("settings.pinHint")}</p>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
              <input
                type="checkbox"
                className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
                checked={pinEnabled}
                onChange={(e) => setPinEnabled(e.target.checked)}
              />
              {t("settings.pinEnable")}
            </label>
            {pinEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="sk-label">{t("settings.pinOnce")}</label>
                  <input
                    type="password"
                    className="sk-input"
                    inputMode="numeric"
                    value={pin1}
                    onChange={(e) => setPin1(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  />
                </div>
                <div>
                  <label className="sk-label">{t("settings.pinTwice")}</label>
                  <input
                    type="password"
                    className="sk-input"
                    inputMode="numeric"
                    value={pin2}
                    onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  />
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="sk-btn-primary"
              disabled={pinBusy}
              onClick={() => void applyPinSettings()}
            >
              {t("settings.pinSave")}
            </button>
            {pinFeedback ? <p className="text-sm text-sage-800">{pinFeedback}</p> : null}
          </section>

          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.fxSection")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("settings.fxExplain")}</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-cream-700">
              <li>{t("settings.fxStepLive")}</li>
              <li>{t("settings.fxStepBuiltin")}</li>
              <li>{t("settings.fxStepOverrides")}</li>
            </ul>
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
            {fxErrDetail ? (
              <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-950">
                {t("settings.fxErrorDetail")}: {fxErrDetail}
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
            <button type="button" className="sk-btn-primary" onClick={() => void saveOverrides()}>
              {t("settings.saveSettings")}
            </button>
          </section>

          <p className="text-sm text-cream-600">
            {t("settings.version")}: <span className="text-cream-900">{APP_VERSION}</span>
          </p>
        </div>
      ) : null}

      {tab === "categories" ? <CategoriesPage omitTitle /> : null}
      {tab === "payments" ? <PaymentMethodsPanel /> : null}

      {tab === "export" ? (
        <div className="space-y-6">
          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("export.groupTitle")}</h3>
            <p className="text-sm text-cream-700">{t("export.groupHint")}</p>
          </section>

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
        </div>
      ) : null}

      {tab === "danger" ? (
        <div className="space-y-6">
          <section className="sk-card border-rose-600/85 bg-rose-50/90 space-y-4">
            <h3 className="text-base font-semibold text-rose-950">{t("settings.dangerZoneTitle")}</h3>
            <p className="text-sm leading-relaxed text-rose-950/95">{t("settings.dangerResetIntro")}</p>
            <p className="text-sm text-rose-900/90">{t("settings.dangerResetExportHint")}</p>

            {dangerStep === 0 ? (
              <div className="space-y-3 border-t border-rose-300/80 pt-4">
                <p className="text-sm text-rose-900">{t("settings.dangerResetStep1Prompt")}</p>
                <button type="button" className="sk-btn-danger" onClick={revealDangerCode}>
                  {t("settings.dangerResetShowCode")}
                </button>
              </div>
            ) : (
              <div className="space-y-4 border-t border-rose-300/80 pt-4">
                <p className="text-sm font-medium text-rose-950">{t("settings.dangerResetChallenge")}</p>
                <p
                  dir="ltr"
                  className="rounded-lg border border-rose-400 bg-cream-50 px-4 py-3 text-center font-mono text-3xl font-bold tracking-[0.2em] text-rose-950"
                >
                  {dangerCode}
                </p>
                <div>
                  <label className="sk-label">{t("settings.dangerResetInputLabel")}</label>
                  <input
                    className="sk-input font-mono"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    value={dangerTyped}
                    onChange={(e) => setDangerTyped(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="sk-btn-danger"
                    disabled={dangerBusy}
                    onClick={() => void executeDangerReset()}
                  >
                    {t("settings.dangerResetExecute")}
                  </button>
                  <button type="button" className="sk-btn-secondary" disabled={dangerBusy} onClick={cancelDangerReset}>
                    {t("settings.dangerResetCancel")}
                  </button>
                </div>
              </div>
            )}

            {dangerMsg ? (
              <p className="rounded-lg border border-amber-600/90 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {dangerMsg}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
