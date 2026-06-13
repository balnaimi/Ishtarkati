import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AUTO_BACKUP_DAYS_KEY,
  AUTO_BACKUP_DIR_KEY,
  AUTO_BACKUP_ENABLED_KEY,
  getPrimaryCurrencyCode,
  getSetting,
  LAST_AUTO_BACKUP_AT_KEY,
  LAST_MANUAL_BACKUP_AT_KEY,
  loadSubscriptions,
  MONTHLY_BUDGET_LIMIT_KEY,
  PIN_ENABLED_KEY,
  PRIMARY_CURRENCY_KEY,
  setSetting,
} from "../db/repo";
import { downloadSubscriptionsCsv, downloadSubscriptionsIcs } from "../lib/tableExport";
import { useFxManager } from "../hooks/useFx";
import { APP_VERSION } from "../version";
import { CategoriesPage } from "./CategoriesPage";
import { TagsPage } from "./TagsPage";
import { ImportBackupDialog } from "../components/ImportBackupDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { listCurrenciesSorted } from "../lib/currenciesData";
import { tCurrency } from "../lib/i18nLabels";
import { formatUiError } from "../lib/uiErrors";
import type { BackupImportPreview } from "../types/backupIPC";
import { type AppLocale, loadAppLocale, persistAppLocale } from "../lib/appLocale";
import {
  loadAndApplyTheme,
  persistThemeMode,
  type ThemeMode,
  watchSystemTheme,
} from "../lib/theme";

const OVERRIDES_KEY = "fx_overrides_json";
const CACHE_KEY = "fx_rates_cache";

type TabId = "app" | "categories" | "tags" | "export" | "danger";

export function SettingsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>("app");
  const [overridesText, setOverridesText] = useState("{}");
  const [fxAt, setFxAt] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [fxMsg, setFxMsg] = useState<string | null>(null);
  const [fxErrDetail, setFxErrDetail] = useState<string | null>(null);
  const [fxBusy, setFxBusy] = useState(false);
  const [overridesErr, setOverridesErr] = useState<string | null>(null);
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
  const [appLanguage, setAppLanguage] = useState<AppLocale>("ar");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [autoBackupOn, setAutoBackupOn] = useState(false);
  const [autoBackupDays, setAutoBackupDays] = useState("7");
  const [autoBackupDir, setAutoBackupDir] = useState("");
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const [lastManualBackup, setLastManualBackup] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateDownloadUrl, setUpdateDownloadUrl] = useState<string | null>(null);
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
      const lang = await loadAppLocale();
      setAppLanguage(lang);
      const mode = await loadAndApplyTheme();
      setThemeMode(mode);
      const budget = await getSetting(MONTHLY_BUDGET_LIMIT_KEY);
      setMonthlyBudget(budget ?? "");
      const abOn = await getSetting(AUTO_BACKUP_ENABLED_KEY);
      setAutoBackupOn(abOn === "1");
      const abd = await getSetting(AUTO_BACKUP_DAYS_KEY);
      setAutoBackupDays(String(Math.max(1, Math.min(90, parseInt(abd ?? "7", 10) || 7))));
      const abDir = await getSetting(AUTO_BACKUP_DIR_KEY);
      setAutoBackupDir(abDir ?? "");
      setLastAutoBackup(await getSetting(LAST_AUTO_BACKUP_AT_KEY));
      setLastManualBackup(await getSetting(LAST_MANUAL_BACKUP_AT_KEY));
      await syncPinStateFromDb();
    })();
  }, [syncFxAt, syncPinStateFromDb]);

  useEffect(() => {
    return watchSystemTheme(() => {
      if (themeMode === "system") void loadAndApplyTheme();
    });
  }, [themeMode]);

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
    if (raw === "payments") {
      nav("/payments", { replace: true });
      return;
    }
    if (raw === "categories" || raw === "tags" || raw === "export" || raw === "danger") {
      setTab(raw);
    } else if (raw === "sync") {
      setTab("export");
      setSearchParams({ tab: "export" }, { replace: true });
    } else {
      setTab("app");
    }
  }, [searchParams, nav]);

  function selectTab(id: TabId) {
    setTab(id);
    if (id === "app") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: id }, { replace: true });
    }
  }

  async function changeAppLanguage(next: AppLocale) {
    if (next === appLanguage) return;
    await persistAppLocale(next);
    setAppLanguage(next);
  }

  async function changeThemeMode(next: ThemeMode) {
    setThemeMode(next);
    await persistThemeMode(next);
  }

  async function saveMonthlyBudget() {
    const trimmed = monthlyBudget.trim();
    await setSetting(MONTHLY_BUDGET_LIMIT_KEY, trimmed);
  }

  async function setAutoBackupEnabled(on: boolean) {
    setAutoBackupOn(on);
    await setSetting(AUTO_BACKUP_ENABLED_KEY, on ? "1" : "0");
  }

  async function saveAutoBackupDays() {
    const d = Math.max(1, Math.min(90, parseInt(autoBackupDays, 10) || 7));
    setAutoBackupDays(String(d));
    await setSetting(AUTO_BACKUP_DAYS_KEY, String(d));
  }

  async function pickAutoBackupDir() {
    const r = await window.ishtarkati.chooseAutoBackupDir();
    if (r.ok) setAutoBackupDir(r.path);
  }

  async function runAutoBackupNow() {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const r = await window.ishtarkati.autoBackupRun();
      if (r.ok) {
        setBackupMsg(`${t("settings.autoBackupOk")}: ${r.path}`);
        setLastAutoBackup(new Date().toISOString());
        await setSetting(LAST_AUTO_BACKUP_AT_KEY, new Date().toISOString());
      } else {
        setBackupMsg(`${t("backup.error")} — ${formatUiError(t, r.error)}`);
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function checkUpdates() {
    setUpdateMsg(null);
    setUpdateDownloadUrl(null);
    setUpdateBusy(true);
    try {
      const r = await window.ishtarkati.checkForUpdates();
      if (r.ok) {
        if (r.updateAvailable) {
          setUpdateMsg(t("settings.updateAvailable", { latest: r.latest, current: APP_VERSION }));
          setUpdateDownloadUrl(r.downloadUrl);
        } else {
          setUpdateMsg(t("settings.updateCurrent", { version: APP_VERSION }));
        }
      } else {
        setUpdateMsg(`${t("settings.updateError")} — ${formatUiError(t, r.error)}`);
      }
    } finally {
      setUpdateBusy(false);
    }
  }

  function parseOverridesJson(raw: string): Record<string, number> | null {
    const trimmed = raw.trim() || "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    for (const v of Object.values(parsed as Record<string, unknown>)) {
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
    }
    return parsed as Record<string, number>;
  }

  async function saveOverrides() {
    const parsed = parseOverridesJson(overridesText);
    if (!parsed) {
      setOverridesErr(t("settings.fxOverridesInvalid"));
      return;
    }
    setOverridesErr(null);
    await setSetting(OVERRIDES_KEY, JSON.stringify(parsed));
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
      setFxErrDetail(formatUiError(t, e));
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

  async function handleBackupExport() {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const r = await window.ishtarkati.backupExport();
      if (r.ok) {
        setBackupMsg(`${t("backup.exportOk")}: ${r.path}`);
        const now = new Date().toISOString();
        await setSetting(LAST_MANUAL_BACKUP_AT_KEY, now);
        setLastManualBackup(now);
      } else if (r.canceled) {
        setBackupMsg(t("backup.canceled"));
      } else {
        setBackupMsg(`${t("backup.error")} — ${formatUiError(t, r.error)}`);
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
        setBackupMsg(`${t("backup.error")} — ${formatUiError(t, r.error)}`);
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function applyImport(filePath: string) {
    setBackupMsg(null);
    setImportApplying(true);
    try {
      const r = await window.ishtarkati.backupApplyImport({ filePath });
      if (r.ok) {
        setImportDlgOpen(false);
        setImportPreview(null);
        setBackupMsg(t("backup.importOk"));
        window.setTimeout(() => {
          window.location.reload();
        }, 600);
      } else {
        setBackupMsg(`${t("backup.error")} — ${formatUiError(t, r.error)}`);
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
        "• Spotify (family): 26 QAR",
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
        setDangerMsg(`${t("settings.dangerResetFailed")} — ${formatUiError(t, r.error)}`);
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
    { id: "export", label: t("settings.tabExport") },
    { id: "danger", label: t("settings.tabDanger") },
  ];

  return (
    <div className="dash-page mx-auto max-w-2xl">
      <ConfirmDialog
        open={pinRemoveConfirmOpen}
        title={t("confirmDialog.pinRemoveTitle")}
        message={t("settings.pinRemoveConfirm")}
        variant="danger"
        confirmLabel={t("settings.pinRemoveStored")}
        onConfirm={() => void removeStoredPinFully()}
        onCancel={() => setPinRemoveConfirmOpen(false)}
      />
      <h1 className="dash-page-title">{t("settings.title")}</h1>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`dash-chip ${tab === x.id ? "dash-chip-active" : "dash-chip-idle"}`}
            onClick={() => selectTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === "app" ? (
        <div className="space-y-4">
          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.languageTitle")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("settings.languageHint")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={appLanguage === "ar" ? "sk-choice-active" : "sk-choice-idle"}
                onClick={() => void changeAppLanguage("ar")}
              >
                {t("settings.languageArabic")}
              </button>
              <button
                type="button"
                className={appLanguage === "en" ? "sk-choice-active" : "sk-choice-idle"}
                onClick={() => void changeAppLanguage("en")}
              >
                {t("settings.languageEnglish")}
              </button>
            </div>
          </section>

          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.appearanceTitle")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("settings.appearanceHint")}</p>
            <div className="flex flex-wrap gap-2">
              {(["light", "dark", "system"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={themeMode === mode ? "sk-choice-active" : "sk-choice-idle"}
                  onClick={() => void changeThemeMode(mode)}
                >
                  {t(`settings.themeMode.${mode}`)}
                </button>
              ))}
            </div>
          </section>

          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.budgetTitle")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("settings.budgetHint")}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="sk-label" htmlFor="monthly-budget">
                  {t("settings.budgetLabel")}
                </label>
                <input
                  id="monthly-budget"
                  className="sk-input mt-1"
                  inputMode="decimal"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder={t("settings.budgetPlaceholder")}
                />
              </div>
              <button type="button" className="sk-btn-secondary" onClick={() => void saveMonthlyBudget()}>
                {t("common.save")}
              </button>
            </div>
          </section>

          <section className="sk-card space-y-3">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.shortcutsTitle")}</h3>
            <p className="text-sm text-cream-700">{t("settings.shortcutsHint")}</p>
            <ul className="space-y-2 text-sm text-cream-800">
              <li><kbd className="rounded border border-cream-400 bg-cream-100 px-1.5 py-0.5 font-mono text-xs">Ctrl+K</kbd> — {t("shortcuts.palette")}</li>
              <li><kbd className="rounded border border-cream-400 bg-cream-100 px-1.5 py-0.5 font-mono text-xs">n</kbd> — {t("shortcuts.new")}</li>
              <li><kbd className="rounded border border-cream-400 bg-cream-100 px-1.5 py-0.5 font-mono text-xs">?</kbd> — {t("shortcuts.help")}</li>
            </ul>
          </section>

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
              onChange={(e) => {
                setOverridesText(e.target.value);
                if (overridesErr) setOverridesErr(null);
              }}
            />
            {overridesErr ? <p className="sk-alert text-sm">{overridesErr}</p> : null}
            <button type="button" className="sk-btn-primary" onClick={() => void saveOverrides()}>
              {t("settings.saveSettings")}
            </button>
          </section>

          <div className="space-y-1">
            <p className="sk-text-hint text-sm">
              {t("settings.version")}: <span className="text-cream-900">{APP_VERSION}</span>
            </p>
            <button
              type="button"
              className="sk-btn-secondary text-sm"
              disabled={updateBusy}
              onClick={() => void checkUpdates()}
            >
              {t("settings.checkUpdates")}
            </button>
            {updateMsg ? <p className="text-sm text-cream-800">{updateMsg}</p> : null}
            {updateDownloadUrl ? (
              <button
                type="button"
                className="sk-btn-primary text-sm"
                onClick={() => void window.ishtarkati.openExternal(updateDownloadUrl)}
              >
                {t("updates.download")}
              </button>
            ) : null}
            <p className="text-xs leading-relaxed text-cream-600">{t("settings.desktopOnly")}</p>
          </div>
        </div>
      ) : null}

      {tab === "categories" ? <CategoriesPage omitTitle /> : null}
      {tab === "tags" ? <TagsPage omitTitle /> : null}
      {tab === "export" ? (
        <div className="space-y-6">
          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("backup.title")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("backup.hint")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="sk-btn-primary min-h-12 flex-1 text-base"
                disabled={backupBusy}
                onClick={() => void handleBackupExport()}
              >
                {t("backup.exportButton")}
              </button>
              <button
                type="button"
                className="sk-btn-secondary min-h-12 flex-1 text-base"
                disabled={backupBusy}
                onClick={() => void prepareImport()}
              >
                {t("backup.restoreButton")}
              </button>
            </div>
            {backupMsg ? <p className="sk-callout-muted">{backupMsg}</p> : null}
            {lastManualBackup ? (
              <p className="text-xs text-cream-600">
                {t("settings.lastManualBackup")}: {lastManualBackup.slice(0, 19)}
              </p>
            ) : (
              <p className="text-xs text-terracotta-700">{t("settings.backupReminder")}</p>
            )}
            <p className="text-xs text-cream-600">{t("backup.versionHint", { exportV: 6 })}</p>
          </section>

          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("settings.autoBackupTitle")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("settings.autoBackupHint")}</p>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
              <input
                type="checkbox"
                className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
                checked={autoBackupOn}
                onChange={(e) => void setAutoBackupEnabled(e.target.checked)}
              />
              {t("settings.autoBackupEnable")}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <label className="sk-label">{t("settings.autoBackupDays")}</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  className="sk-input mt-1 max-w-[8rem]"
                  value={autoBackupDays}
                  onChange={(e) => setAutoBackupDays(e.target.value)}
                  onBlur={() => void saveAutoBackupDays()}
                />
              </div>
              <button type="button" className="sk-btn-secondary" onClick={() => void pickAutoBackupDir()}>
                {t("settings.autoBackupChooseDir")}
              </button>
              <button
                type="button"
                className="sk-btn-primary"
                disabled={backupBusy || !autoBackupDir}
                onClick={() => void runAutoBackupNow()}
              >
                {t("settings.autoBackupRunNow")}
              </button>
            </div>
            {autoBackupDir ? (
              <p className="break-all text-xs text-cream-600" dir="ltr">
                {autoBackupDir}
              </p>
            ) : null}
            {lastAutoBackup ? (
              <p className="text-xs text-cream-600">
                {t("settings.lastAutoBackup")}: {lastAutoBackup.slice(0, 19)}
              </p>
            ) : null}
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
        onConfirm={(filePath) => void applyImport(filePath)}
      />
    </div>
  );
}
