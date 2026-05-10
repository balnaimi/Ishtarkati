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
import { TagsSettingsPanel } from "../components/TagsSettingsPanel";
import { ImportBackupDialog } from "../components/ImportBackupDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { listCurrenciesSorted } from "../lib/currenciesData";
import { tCurrency } from "../lib/i18nLabels";
import type { BackupImportApplyArgs, BackupImportPreview } from "../types/backupIPC";

const OVERRIDES_KEY = "fx_overrides_json";
const CACHE_KEY = "fx_rates_cache";

type TabId = "app" | "categories" | "tags" | "payments" | "export" | "danger";

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
  const [reminderDays, setReminderDays] = useState("7");
  const [reminderWeekly, setReminderWeekly] = useState(false);
  const [reminderMonthly, setReminderMonthly] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [primaryCurrency, setPrimaryCurrency] = useState("QAR");
  const [pinHasStored, setPinHasStored] = useState(false);
  const [pinRemoveConfirmOpen, setPinRemoveConfirmOpen] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinPanel, setPinPanel] = useState<null | "set" | "changeCurrent" | "changeNew">(null);
  const [pinCurrent, setPinCurrent] = useState("");
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);
  const [dangerStep, setDangerStep] = useState<0 | 1>(0);
  const [dangerCode, setDangerCode] = useState("");
  const [dangerTyped, setDangerTyped] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerMsg, setDangerMsg] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<BackupImportPreview | null>(null);
  const [importDlgOpen, setImportDlgOpen] = useState(false);
  const [importApplying, setImportApplying] = useState(false);
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

  const syncPinStateFromDb = useCallback(async () => {
    try {
      const [st, pe] = await Promise.all([window.ishtarkati.pinStatus(), getSetting(PIN_ENABLED_KEY)]);
      setPinHasStored(Boolean(st?.hasPin));
      setPinEnabled(pe === "1");
    } catch {
      setPinHasStored(false);
      setPinEnabled(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const raw = await getSetting(OVERRIDES_KEY);
      if (raw) setOverridesText(raw);
      await syncFxAt();
      const rem = await getSetting("reminders_enabled");
      setRemindersOn(rem === "1");
      const rd = await getSetting("reminder_due_days");
      const d = Math.max(1, Math.min(90, parseInt(rd ?? "7", 10) || 7));
      setReminderDays(String(d));
      const rw = await getSetting("reminder_weekly_enabled");
      setReminderWeekly(rw === "1");
      const rm = await getSetting("reminder_monthly_enabled");
      setReminderMonthly(rm === "1");
      const prim = await getPrimaryCurrencyCode();
      setPrimaryCurrency(prim);
      await syncPinStateFromDb();
    })();
  }, [syncFxAt, syncPinStateFromDb]);

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
    if (raw === "categories" || raw === "tags" || raw === "payments" || raw === "export" || raw === "danger") {
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

  async function handleExportFull() {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const r = await window.ishtarkati.backupExport({ scope: "full" });
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

  async function handleExportWithoutSettings() {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const r = await window.ishtarkati.backupExport({ scope: "without_settings" });
      if (r.ok) {
        setBackupMsg(`${t("backup.exportOkWithoutSettings")}: ${r.path}`);
      } else if (r.canceled) {
        setBackupMsg(t("backup.canceled"));
      } else {
        setBackupMsg(`${t("backup.error")}${r.error ? ` — ${r.error}` : ""}`);
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function prepareImport() {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const r = await window.ishtarkati.backupPrepareImport();
      if (r.ok) {
        setImportPreview(r.preview);
        setImportDlgOpen(true);
      } else if (r.canceled) {
        setBackupMsg(t("backup.canceled"));
      } else {
        setBackupMsg(`${t("backup.error")}${r.error ? ` — ${r.error}` : ""}`);
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function applyImport(args: BackupImportApplyArgs) {
    setBackupMsg(null);
    setImportApplying(true);
    try {
      const r = await window.ishtarkati.backupApplyImport(args);
      if (r.ok) {
        setImportDlgOpen(false);
        setImportPreview(null);
        setBackupMsg(t("backup.importOk"));
        window.setTimeout(() => {
          window.location.reload();
        }, 600);
      } else {
        setBackupMsg(`${t("backup.error")}${r.error ? ` — ${r.error}` : ""}`);
      }
    } finally {
      setImportApplying(false);
    }
  }

  async function setRemindersEnabled(on: boolean) {
    await setSetting("reminders_enabled", on ? "1" : "0");
    setRemindersOn(on);
  }

  async function persistReminderDays(raw: string) {
    const n = Math.max(1, Math.min(90, parseInt(raw, 10) || 7));
    await setSetting("reminder_due_days", String(n));
    setReminderDays(String(n));
  }

  async function setWeeklyDigest(on: boolean) {
    await setSetting("reminder_weekly_enabled", on ? "1" : "0");
    setReminderWeekly(on);
  }

  async function setMonthlyDigest(on: boolean) {
    await setSetting("reminder_monthly_enabled", on ? "1" : "0");
    setReminderMonthly(on);
  }

  async function savePrimary(code: string) {
    await setSetting(PRIMARY_CURRENCY_KEY, code.trim().toUpperCase());
    setPrimaryCurrency(code.trim().toUpperCase());
  }

  async function testNotify() {
    await window.ishtarkati.showNotification({
      title: t("notify.digestTitle"),
      body: [
        t("settings.testNotifyBody"),
        "",
        "• Netflix: 45 USD — ≈ 164.00 QAR",
        "• Spotify (عائلة): 26 QAR",
      ].join("\n"),
    });
  }

  function resetPinWorkflow() {
    setPinPanel(null);
    setPinCurrent("");
    setPin1("");
    setPin2("");
  }

  async function saveNewPinPair() {
    setPinFeedback(null);
    if (pin1.length < 4) {
      setPinFeedback(t("pin.tooShort"));
      return;
    }
    if (pin1 !== pin2) {
      setPinFeedback(t("pin.mismatch"));
      return;
    }
    setPinBusy(true);
    try {
      const r = await window.ishtarkati.setPin(pin1);
      if (!r.ok) {
        setPinFeedback(t("pin.setFailed"));
        return;
      }
      await setSetting(PIN_ENABLED_KEY, "1");
      const isChange = pinPanel === "changeNew";
      setPinFeedback(isChange ? t("pin.changedOk") : t("pin.enabledOk"));
      resetPinWorkflow();
      await syncPinStateFromDb();
    } finally {
      setPinBusy(false);
    }
  }

  async function verifyCurrentPinThenAdvance() {
    setPinFeedback(null);
    if (pinCurrent.length < 4) {
      setPinFeedback(t("pin.tooShort"));
      return;
    }
    setPinBusy(true);
    try {
      const ok = await window.ishtarkati.verifyPin(pinCurrent);
      if (!ok) {
        setPinFeedback(t("settings.pinWrongCurrent"));
        return;
      }
      setPinCurrent("");
      setPin1("");
      setPin2("");
      setPinFeedback(null);
      setPinPanel("changeNew");
    } finally {
      setPinBusy(false);
    }
  }

  async function pausePinLock() {
    setPinBusy(true);
    try {
      await setSetting(PIN_ENABLED_KEY, "0");
      setPinEnabled(false);
      setPinFeedback(t("settings.pinLockPausedOk"));
      await syncPinStateFromDb();
    } finally {
      setPinBusy(false);
    }
  }

  async function resumePinLock() {
    if (!pinHasStored) return;
    setPinBusy(true);
    try {
      await setSetting(PIN_ENABLED_KEY, "1");
      setPinEnabled(true);
      setPinFeedback(t("settings.pinLockResumedOk"));
      await syncPinStateFromDb();
    } finally {
      setPinBusy(false);
    }
  }

  async function removeStoredPinFully() {
    if (!pinHasStored) return;
    setPinRemoveConfirmOpen(false);
    setPinBusy(true);
    try {
      await window.ishtarkati.clearPin();
      await setSetting(PIN_ENABLED_KEY, "0");
      resetPinWorkflow();
      setPinFeedback(t("settings.pinRemovedOk"));
      await syncPinStateFromDb();
    } finally {
      setPinBusy(false);
    }
  }

  useEffect(() => {
    if (tab === "app") void syncPinStateFromDb();
  }, [tab, syncPinStateFromDb]);

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
        try {
          sessionStorage.clear();
        } catch {
          /* ignore */
        }
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
    { id: "tags", label: t("settings.tabTags") },
    { id: "payments", label: t("settings.tabPayments") },
    { id: "export", label: t("settings.tabExport") },
    { id: "danger", label: t("settings.tabDanger") },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ConfirmDialog
        open={pinRemoveConfirmOpen}
        title={t("confirmDialog.pinRemoveTitle")}
        message={t("settings.pinRemoveConfirm")}
        variant="danger"
        confirmLabel={t("settings.pinRemoveStored")}
        onConfirm={() => void removeStoredPinFully()}
        onCancel={() => setPinRemoveConfirmOpen(false)}
      />
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
                  {c.flag} {c.code} — {tCurrency(t, c.code)}
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
            <div>
              <label className="sk-label" htmlFor="reminder-days">
                {t("settings.reminderDaysLabel")}
              </label>
              <input
                id="reminder-days"
                type="number"
                min={1}
                max={90}
                className="sk-input mt-1 max-w-[8rem]"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                onBlur={() => void persistReminderDays(reminderDays)}
              />
              <p className="mt-1 text-xs text-cream-600">{t("settings.reminderDaysHint")}</p>
            </div>
            <p className="text-xs font-medium text-cream-800">{t("settings.reminderDigestSchedTitle")}</p>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
              <input
                type="checkbox"
                className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
                checked={reminderWeekly}
                onChange={(e) => void setWeeklyDigest(e.target.checked)}
                disabled={!remindersOn}
              />
              {t("settings.reminderWeekly")}
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
              <input
                type="checkbox"
                className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
                checked={reminderMonthly}
                onChange={(e) => void setMonthlyDigest(e.target.checked)}
                disabled={!remindersOn}
              />
              {t("settings.reminderMonthly")}
            </label>
            <p className="text-xs text-cream-600">{t("settings.reminderSchedHint")}</p>
            <button type="button" className="sk-btn-secondary" onClick={() => void testNotify()}>
              {t("settings.testNotify")}
            </button>
          </section>

          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.pinSection")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("settings.pinHintShort")}</p>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={
                  pinEnabled && pinHasStored ? "sk-status-badge-on" : "sk-status-badge-off"
                }
              >
                {pinEnabled && pinHasStored ? t("settings.pinBadgeOn") : t("settings.pinBadgeOff")}
              </span>
              {pinHasStored && !pinEnabled ? (
                <span className="sk-text-hint text-xs leading-relaxed">{t("settings.pinStoredPausedHint")}</span>
              ) : null}
            </div>

            {pinFeedback ? <p className="sk-callout-muted">{pinFeedback}</p> : null}

            <div className="flex flex-wrap gap-3">
              {pinHasStored ? (
                <button
                  type="button"
                  className="sk-btn-secondary"
                  disabled={pinBusy || Boolean(pinPanel)}
                  onClick={() => {
                    setPinFeedback(null);
                    resetPinWorkflow();
                    setPinPanel("changeCurrent");
                  }}
                >
                  {t("settings.pinBtnChange")}
                </button>
              ) : (
                <button
                  type="button"
                  className="sk-btn-primary"
                  disabled={pinBusy || Boolean(pinPanel)}
                  onClick={() => {
                    setPinFeedback(null);
                    resetPinWorkflow();
                    setPinPanel("set");
                  }}
                >
                  {t("settings.pinBtnSet")}
                </button>
              )}

              {pinHasStored && pinEnabled ? (
                <button
                  type="button"
                  className="sk-btn-muted text-sm"
                  disabled={pinBusy || Boolean(pinPanel)}
                  onClick={() => void pausePinLock()}
                >
                  {t("settings.pinLockPause")}
                </button>
              ) : null}
              {pinHasStored && !pinEnabled ? (
                <button
                  type="button"
                  className="sk-btn-primary"
                  disabled={pinBusy || Boolean(pinPanel)}
                  onClick={() => void resumePinLock()}
                >
                  {t("settings.pinLockResume")}
                </button>
              ) : null}
            </div>

            {pinHasStored ? (
              <div className="sk-callout-danger">
                <p className="text-sm font-semibold">{t("settings.pinRemoveBoxTitle")}</p>
                <p className="text-xs leading-relaxed opacity-90">{t("settings.pinRemoveBoxHint")}</p>
                <button
                  type="button"
                  className="sk-btn-danger w-full sm:w-auto"
                  disabled={pinBusy || Boolean(pinPanel)}
                  onClick={() => setPinRemoveConfirmOpen(true)}
                >
                  {t("settings.pinRemoveStored")}
                </button>
              </div>
            ) : null}

            {pinPanel === "set" ? (
              <div className="sk-panel-nested">
                <p className="text-sm font-medium text-cream-900">{t("settings.pinSetTitle")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="sk-label">{t("settings.pinOnce")}</label>
                    <input
                      type="password"
                      className="sk-input"
                      inputMode="numeric"
                      autoComplete="new-password"
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
                      autoComplete="new-password"
                      value={pin2}
                      onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="sk-btn-secondary" disabled={pinBusy} onClick={resetPinWorkflow}>
                    {t("settings.pinBtnCancel")}
                  </button>
                  <button type="button" className="sk-btn-primary" disabled={pinBusy} onClick={() => void saveNewPinPair()}>
                    {t("settings.pinBtnSave")}
                  </button>
                </div>
              </div>
            ) : null}

            {pinPanel === "changeCurrent" ? (
              <div className="sk-panel-nested">
                <p className="text-sm font-medium text-cream-900">{t("settings.pinChangeStepCurrent")}</p>
                <div>
                  <label className="sk-label">{t("settings.pinCurrentLabel")}</label>
                  <input
                    type="password"
                    className="sk-input max-w-xs"
                    inputMode="numeric"
                    autoComplete="current-password"
                    value={pinCurrent}
                    onChange={(e) => setPinCurrent(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void verifyCurrentPinThenAdvance();
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="sk-btn-secondary" disabled={pinBusy} onClick={resetPinWorkflow}>
                    {t("settings.pinBtnCancel")}
                  </button>
                  <button
                    type="button"
                    className="sk-btn-primary"
                    disabled={pinBusy}
                    onClick={() => void verifyCurrentPinThenAdvance()}
                  >
                    {t("settings.pinBtnContinue")}
                  </button>
                </div>
              </div>
            ) : null}

            {pinPanel === "changeNew" ? (
              <div className="sk-panel-nested">
                <p className="text-sm font-medium text-cream-900">{t("settings.pinChangeStepNew")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="sk-label">{t("settings.pinOnceNew")}</label>
                    <input
                      type="password"
                      className="sk-input"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={pin1}
                      onChange={(e) => setPin1(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    />
                  </div>
                  <div>
                    <label className="sk-label">{t("settings.pinTwiceNew")}</label>
                    <input
                      type="password"
                      className="sk-input"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={pin2}
                      onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="sk-btn-secondary"
                    disabled={pinBusy}
                    onClick={() => {
                      resetPinWorkflow();
                      setPinFeedback(null);
                    }}
                  >
                    {t("settings.pinBtnCancel")}
                  </button>
                  <button type="button" className="sk-btn-primary" disabled={pinBusy} onClick={() => void saveNewPinPair()}>
                    {t("settings.pinBtnSaveNew")}
                  </button>
                </div>
              </div>
            ) : null}
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
            {!fx.hasLiveFxCache ? <p className="sk-text-hint text-xs">{t("fx.noLiveCacheYet")}</p> : null}
            <button
              type="button"
              className="sk-btn-primary"
              disabled={fxBusy}
              onClick={() => void handleRefreshFx()}
            >
              {t("settings.refreshFxButton")}
            </button>
            {fxMsg ? <p className="sk-text-success text-sm">{fxMsg}</p> : null}
            {fxErrDetail ? (
              <p className="sk-code-error">
                {t("settings.fxErrorDetail")}: {fxErrDetail}
              </p>
            ) : null}
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.fxOverrides")}</h3>
            <p className="sk-text-hint mb-2 text-xs">{t("settings.fxOverridesHint")}</p>
            <textarea
              className="sk-textarea font-mono text-sm leading-relaxed"
              value={overridesText}
              onChange={(e) => setOverridesText(e.target.value)}
            />
            <button type="button" className="sk-btn-primary" onClick={() => void saveOverrides()}>
              {t("settings.saveSettings")}
            </button>
          </section>

          <div className="space-y-1">
            <p className="sk-text-hint text-sm">
              {t("settings.version")}: <span className="text-cream-900">{APP_VERSION}</span>
            </p>
            <p className="text-xs leading-relaxed text-cream-600">{t("settings.desktopOnly")}</p>
          </div>
        </div>
      ) : null}

      {tab === "categories" ? <CategoriesPage omitTitle /> : null}
      {tab === "tags" ? <TagsSettingsPanel /> : null}
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
            <p className="text-xs text-cream-600">{t("backup.versionHint", { exportV: 6 })}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className="sk-btn-primary"
                disabled={backupBusy}
                onClick={() => void handleExportFull()}
              >
                {t("backup.exportFull")}
              </button>
              <button
                type="button"
                className="sk-btn-secondary"
                disabled={backupBusy}
                onClick={() => void handleExportWithoutSettings()}
              >
                {t("backup.exportWithoutSettings")}
              </button>
              <button
                type="button"
                className="sk-btn-secondary"
                disabled={backupBusy}
                onClick={() => void prepareImport()}
              >
                {t("backup.import")}
              </button>
            </div>
            {backupMsg ? <p className="sk-callout-muted">{backupMsg}</p> : null}
          </section>
        </div>
      ) : null}

      {tab === "danger" ? (
        <div className="space-y-6">
          <section className="sk-section-danger">
            <h3>{t("settings.dangerZoneTitle")}</h3>
            <p>{t("settings.dangerResetIntro")}</p>
            <p>{t("settings.dangerResetExportHint")}</p>

            {dangerStep === 0 ? (
              <div className="space-y-3 border-t border-cream-500/25 pt-4">
                <p className="text-sm">{t("settings.dangerResetStep1Prompt")}</p>
                <button type="button" className="sk-btn-danger" onClick={revealDangerCode}>
                  {t("settings.dangerResetShowCode")}
                </button>
              </div>
            ) : (
              <div className="space-y-4 border-t border-cream-500/25 pt-4">
                <p className="text-sm font-medium">{t("settings.dangerResetChallenge")}</p>
                <p dir="ltr" className="sk-danger-code-box">
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

            {dangerMsg ? <p className="sk-callout-warning text-sm">{dangerMsg}</p> : null}
          </section>
        </div>
      ) : null}

      <ImportBackupDialog
        open={importDlgOpen}
        preview={importPreview}
        applying={importApplying}
        onClose={() => {
          if (importApplying) return;
          setImportDlgOpen(false);
          setImportPreview(null);
        }}
        onApply={(args) => void applyImport(args)}
      />
    </div>
  );
}
