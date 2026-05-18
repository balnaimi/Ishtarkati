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
import { ImportBackupDialog } from "../components/ImportBackupDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { listCurrenciesSorted } from "../lib/currenciesData";
import { tCurrency } from "../lib/i18nLabels";
import type { BackupImportApplyArgs, BackupImportPreview } from "../types/backupIPC";

const OVERRIDES_KEY = "fx_overrides_json";
const CACHE_KEY = "fx_rates_cache";

type TabId = "app" | "categories" | "payments" | "export" | "sync" | "danger";

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
  const [syncBaseUrl, setSyncBaseUrl] = useState("");
  const [syncVaultId, setSyncVaultId] = useState("");
  const [syncDisplayName, setSyncDisplayName] = useState("");
  const [syncSetupMode, setSyncSetupMode] = useState<"create" | "link">("link");
  const [syncLinkBy, setSyncLinkBy] = useState<"name" | "id">("name");
  const [syncLookupName, setSyncLookupName] = useState("");
  const [syncPassword, setSyncPassword] = useState("");
  const [syncPasswordNew, setSyncPasswordNew] = useState("");
  const [syncPasswordNew2, setSyncPasswordNew2] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncMsgIsError, setSyncMsgIsError] = useState(false);
  const [syncSessionOpen, setSyncSessionOpen] = useState(false);
  const [syncRemember, setSyncRemember] = useState(false);
  const [syncActivityLog, setSyncActivityLog] = useState<
    Array<{ at: string; kind: string; detail?: string }>
  >([]);
  const [syncRemote, setSyncRemote] = useState<{
    revision: number;
    has_snapshot: boolean;
    max_backup_export_version: number;
    min_client_semver: string;
  } | null>(null);
  const [syncBackupJson, setSyncBackupJson] = useState<string | null>(null);
  const [syncPullRevision, setSyncPullRevision] = useState<number | null>(null);
  const [syncPushScope, setSyncPushScope] = useState<"full" | "without_settings">("full");
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
    void (async () => {
      const r = await window.ishtarkati.syncGetLocalConfig();
      if (r.ok) {
        setSyncBaseUrl(r.baseUrl);
        setSyncVaultId(r.vaultId);
        setSyncDisplayName(r.displayName);
        setSyncSessionOpen(r.sessionUnlocked);
        setSyncRemember(r.rememberEnabled);
        setSyncSetupMode(r.vaultId ? "link" : "create");
      }
    })();
  }, []);

  useEffect(() => {
    if (tab !== "sync") return;
    void (async () => {
      const r = await window.ishtarkati.syncGetLocalConfig();
      if (r.ok) {
        setSyncBaseUrl(r.baseUrl);
        setSyncVaultId(r.vaultId);
        setSyncDisplayName(r.displayName);
        setSyncSessionOpen(r.sessionUnlocked);
        setSyncRemember(r.rememberEnabled);
      }
      const log = await window.ishtarkati.syncGetActivityLog();
      if (log.ok) setSyncActivityLog(log.entries);
    })();
  }, [tab]);

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
    if (
      raw === "categories" ||
      raw === "payments" ||
      raw === "export" ||
      raw === "sync" ||
      raw === "danger"
    ) {
      setTab(raw);
    } else if (raw === "tags") {
      setTab("categories");
      setSearchParams({ tab: "categories" }, { replace: true });
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
    setSyncBackupJson(null);
    setSyncPullRevision(null);
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
        setSyncBackupJson(null);
        if (syncPullRevision != null) {
          await window.ishtarkati.syncRecordPulledRevision({ revision: syncPullRevision });
          setSyncPullRevision(null);
        }
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

  function clearSyncFeedback() {
    setSyncMsg(null);
    setSyncMsgIsError(false);
  }

  function showSyncSuccess(message: string) {
    setSyncMsgIsError(false);
    setSyncMsg(message);
  }

  function showSyncFailure(message: string) {
    setSyncMsgIsError(true);
    setSyncMsg(message);
  }

  function formatSyncError(err: string): string {
    if (!err) return t("sync.errors.generic");
    if (err.includes("no-database")) return t("sync.errors.no_database");
    if (err === "invalid") return t("sync.errors.sync_invalid_payload");
    if (err.includes("sync_invalid_payload")) return t("sync.errors.sync_invalid_payload");
    if (err.includes("sync_missing_base")) return t("sync.errors.sync_missing_base");
    if (err.includes("sync_network_unreachable")) return t("sync.errors.sync_network_unreachable");
    if (err.includes("sync_network_error")) return t("sync.errors.sync_network_unreachable");
    if (err.includes("sync_conflict")) return t("sync.conflictHint");
    if (err.includes("need_app_update_capabilities")) return t("sync.errors.need_app_update_capabilities");
    if (err.includes("need_app_update_vault")) return t("sync.errors.need_app_update_vault");
    if (err.includes("export_version_too_new_vault")) return t("sync.errors.export_version_too_new_vault");
    if (err.includes("export_version_too_new")) return t("sync.errors.export_version_too_new");
    if (err.includes("sync_no_snapshot")) return t("sync.errors.sync_no_snapshot");
    if (err.includes("sync_need_password_or_unlock")) return t("sync.errors.sync_need_password_or_unlock");
    if (err.includes("sync_unauthorized")) return t("sync.errors.sync_unauthorized");
    if (err.includes("sync_weak_password")) return t("sync.errors.sync_weak_password");
    if (err.includes("sync_vault_not_found")) return t("sync.errors.sync_vault_not_found");
    if (err.includes("sync_pull_required_first")) return t("sync.errors.sync_pull_required_first");
    if (err.includes("sync_capabilities_http_")) return t("sync.errors.sync_server_http");
    if (err.includes("sync_status_http_")) return t("sync.errors.sync_server_http");
    if (err.includes("sync_create_http_")) return t("sync.errors.sync_server_http");
    if (err.includes("sync_pull_http_")) return t("sync.errors.sync_server_http");
    if (err.includes("sync_push_http_")) return t("sync.errors.sync_server_http");
    if (err.includes("sync_lookup_http_")) return t("sync.errors.sync_server_http");
    if (err.includes("sync_name_not_found")) return t("sync.errors.sync_name_not_found");
    if (err.includes("sync_invalid_name")) return t("sync.errors.sync_invalid_name");
    if (err.includes("sync_name_taken")) return t("sync.errors.sync_name_taken");
    if (err.includes("sync_invalid_display_name")) return t("sync.errors.sync_invalid_display_name");
    if (err.includes("sync_display_name_required")) return t("sync.errors.sync_display_name_required");
    if (err.includes("sync_missing_fields")) return t("sync.errors.sync_missing_fields");
    if (err.includes("sync_remember_unavailable")) return t("sync.errors.sync_remember_unavailable");
    if (err.includes("sync_create_failed")) return t("sync.errors.sync_create_failed");
    if (err.includes("sync_invalid_token_hash")) return t("sync.errors.sync_invalid_token_hash");
    if (err.startsWith("sync_server_code:")) {
      return t("sync.errors.sync_server_code", { code: err.slice("sync_server_code:".length) });
    }
    if (err.startsWith("sync_server_body:")) {
      return t("sync.errors.sync_server_body", { detail: err.slice("sync_server_body:".length) });
    }
    if (err.includes("SQLITE") || err.toLowerCase().includes("sqlite")) {
      return t("sync.errors.sync_local_db", { detail: err });
    }
    return t("sync.errors.sync_detail", { detail: err });
  }

  async function handleSyncRememberChange(checked: boolean) {
    setSyncRemember(checked);
    if (!window.ishtarkati) return;
    if (!checked) {
      await window.ishtarkati.syncSetRememberSession({ enabled: false });
      return;
    }
    const pwd =
      syncSetupMode === "create"
        ? syncPasswordNew
        : syncPassword;
    if (pwd.length < 8) {
      setSyncRemember(false);
      showSyncFailure(t("sync.errors.sync_weak_password"));
      return;
    }
    const r = await window.ishtarkati.syncSetRememberSession({ enabled: true, password: pwd });
    if (!r.ok) {
      setSyncRemember(false);
      showSyncFailure(formatSyncError(r.error ?? ""));
    }
  }

  async function handleSyncSaveConfig() {
    clearSyncFeedback();
    if (!window.ishtarkati) {
      showSyncFailure(t("sync.errors.sync_not_electron"));
      return;
    }
    setSyncBusy(true);
    try {
      const r = await window.ishtarkati.syncSaveLocalConfig({
        baseUrl: syncBaseUrl.trim(),
        vaultId: syncVaultId.trim(),
        displayName: syncDisplayName.trim(),
      });
      if (!r.ok) {
        showSyncFailure(formatSyncError(r.error ?? ""));
        return;
      }
      const st = await window.ishtarkati.syncGetLocalConfig();
      if (st.ok) setSyncSessionOpen(st.sessionUnlocked);
      showSyncSuccess(t("common.save"));
    } catch (e) {
      showSyncFailure(
        t("sync.errors.sync_unexpected", { detail: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleSyncUnlock() {
    clearSyncFeedback();
    if (!window.ishtarkati) {
      showSyncFailure(t("sync.errors.sync_not_electron"));
      return;
    }
    setSyncBusy(true);
    try {
      const r = await window.ishtarkati.syncUnlockSession({
        baseUrl: syncBaseUrl.trim(),
        vaultId: syncVaultId.trim(),
        password: syncPassword,
        remember: syncRemember,
      });
      if (!r.ok) {
        showSyncFailure(formatSyncError(r.error ?? ""));
        return;
      }
      setSyncSessionOpen(true);
      showSyncSuccess(t("sync.sessionUnlocked"));
    } catch (e) {
      showSyncFailure(
        t("sync.errors.sync_unexpected", { detail: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleSyncClearSession() {
    try {
      await window.ishtarkati?.syncClearSession();
    } catch {
      /* ignore */
    }
    setSyncSessionOpen(false);
    clearSyncFeedback();
  }

  async function handleSyncTest() {
    clearSyncFeedback();
    if (!window.ishtarkati) {
      showSyncFailure(t("sync.errors.sync_not_electron"));
      return;
    }
    if (!syncBaseUrl.trim()) {
      showSyncFailure(t("sync.errors.sync_missing_base"));
      return;
    }
    setSyncBusy(true);
    try {
      const r = await window.ishtarkati.syncCapabilities({ baseUrl: syncBaseUrl.trim() });
      if (!r.ok) {
        showSyncFailure(formatSyncError(r.error ?? ""));
        return;
      }
      showSyncSuccess(
        `${t("sync.minAppVersion", { v: r.cap.min_client_semver })} — ${t("sync.exportVersionLimit", { v: r.cap.max_backup_export_version })}`,
      );
    } catch (e) {
      showSyncFailure(
        t("sync.errors.sync_unexpected", { detail: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleSyncLookupVaultByName() {
    clearSyncFeedback();
    if (!window.ishtarkati) {
      showSyncFailure(t("sync.errors.sync_not_electron"));
      return;
    }
    if (!syncBaseUrl.trim()) {
      showSyncFailure(t("sync.errors.sync_missing_base"));
      return;
    }
    setSyncBusy(true);
    try {
      const r = await window.ishtarkati.syncLookupVaultByName({
        baseUrl: syncBaseUrl.trim(),
        name: syncLookupName.trim(),
      });
      if (!r.ok) {
        showSyncFailure(formatSyncError(r.error ?? ""));
        return;
      }
      setSyncVaultId(r.vaultId);
      setSyncDisplayName(r.displayName);
      showSyncSuccess(t("sync.lookupOk"));
    } catch (e) {
      showSyncFailure(
        t("sync.errors.sync_unexpected", { detail: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleSyncCreateVault() {
    clearSyncFeedback();
    if (!window.ishtarkati) {
      showSyncFailure(t("sync.errors.sync_not_electron"));
      return;
    }
    if (!syncBaseUrl.trim()) {
      showSyncFailure(t("sync.errors.sync_missing_base"));
      return;
    }
    if (syncDisplayName.trim().length < 2) {
      showSyncFailure(t("sync.errors.sync_display_name_required"));
      return;
    }
    if (syncPasswordNew.length < 8) {
      showSyncFailure(t("sync.errors.sync_weak_password"));
      return;
    }
    if (syncPasswordNew !== syncPasswordNew2) {
      showSyncFailure(t("sync.passwordMismatch"));
      return;
    }
    setSyncBusy(true);
    try {
      const r = await window.ishtarkati.syncCreateVault({
        baseUrl: syncBaseUrl.trim(),
        password: syncPasswordNew,
        displayName: syncDisplayName.trim(),
        remember: syncRemember,
      });
      if (!r.ok) {
        showSyncFailure(formatSyncError(r.error ?? ""));
        return;
      }
      setSyncVaultId(r.vaultId);
      setSyncDisplayName(r.displayName);
      setSyncPasswordNew("");
      setSyncPasswordNew2("");
      setSyncSessionOpen(true);
      setSyncSetupMode("link");
      showSyncSuccess(t("sync.createOk"));
    } catch (e) {
      showSyncFailure(
        t("sync.errors.sync_unexpected", { detail: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleSyncCheckRemote() {
    clearSyncFeedback();
    if (!window.ishtarkati) {
      showSyncFailure(t("sync.errors.sync_not_electron"));
      return;
    }
    setSyncBusy(true);
    try {
      const r = await window.ishtarkati.syncRemoteStatus({
        baseUrl: syncBaseUrl.trim(),
        vaultId: syncVaultId.trim(),
      });
      if (!r.ok) {
        setSyncRemote(null);
        showSyncFailure(formatSyncError(r.error ?? ""));
        return;
      }
      setSyncRemote({
        revision: r.status.revision,
        has_snapshot: r.status.has_snapshot,
        max_backup_export_version: r.status.max_backup_export_version,
        min_client_semver: r.status.min_client_semver,
      });
    } catch (e) {
      showSyncFailure(
        t("sync.errors.sync_unexpected", { detail: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleSyncPullPreview() {
    clearSyncFeedback();
    if (!window.ishtarkati) {
      showSyncFailure(t("sync.errors.sync_not_electron"));
      return;
    }
    setBackupMsg(null);
    setSyncBusy(true);
    try {
      const r = await window.ishtarkati.syncPullPreview({
        baseUrl: syncBaseUrl.trim(),
        vaultId: syncVaultId.trim(),
        password: syncPassword,
      });
      if (!r.ok) {
        showSyncFailure(formatSyncError(r.error ?? ""));
        return;
      }
      setImportPreview(r.preview);
      setSyncBackupJson(r.backupJson);
      setSyncPullRevision(r.serverRevision);
      setImportDlgOpen(true);
    } catch (e) {
      showSyncFailure(
        t("sync.errors.sync_unexpected", { detail: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleSyncPush() {
    clearSyncFeedback();
    if (!window.ishtarkati) {
      showSyncFailure(t("sync.errors.sync_not_electron"));
      return;
    }
    setSyncBusy(true);
    try {
      const r = await window.ishtarkati.syncPush({
        baseUrl: syncBaseUrl.trim(),
        vaultId: syncVaultId.trim(),
        password: syncPassword,
        scope: syncPushScope,
      });
      if (!r.ok) {
        if (r.conflict) {
          showSyncFailure(t("sync.conflictHint"));
        } else {
          showSyncFailure(formatSyncError(r.error ?? ""));
        }
        return;
      }
      showSyncSuccess(t("sync.pushOk", { rev: String(r.revision ?? "—") }));
    } catch (e) {
      showSyncFailure(
        t("sync.errors.sync_unexpected", { detail: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setSyncBusy(false);
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "app", label: t("settings.tabApp") },
    { id: "categories", label: t("settings.tabCategories") },
    { id: "payments", label: t("settings.tabPayments") },
    { id: "export", label: t("settings.tabExport") },
    { id: "sync", label: t("settings.tabSync") },
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

      {tab === "sync" ? (
        <div className="space-y-6">
          <section className="sk-card space-y-3">
            <h3 className="text-base font-semibold text-cream-900">{t("sync.introTitle")}</h3>
            <p className="text-sm leading-relaxed text-cream-700">{t("sync.introBody")}</p>
            <p className="text-sm leading-relaxed text-cream-700">{t("sync.simpleAutoBody")}</p>
            <div className="sk-callout-warning text-sm leading-relaxed">
              {syncBaseUrl.trim() && syncVaultId.trim() ? (
                syncSessionOpen ? (
                  <p>{t("sync.simpleStatusOn")}</p>
                ) : (
                  <p>{t("sync.simpleStatusNeedUnlock")}</p>
                )
              ) : (
                <p>{t("sync.simpleStatusNotLinked")}</p>
              )}
            </div>
          </section>

          <section className="sk-card space-y-4">
            <div>
              <label className="sk-label" htmlFor="sync-base">
                {t("sync.baseUrl")}
              </label>
              <input
                id="sync-base"
                className="sk-input font-mono text-sm"
                dir="ltr"
                value={syncBaseUrl}
                onChange={(e) => setSyncBaseUrl(e.target.value)}
                placeholder="localhost:8080"
              />
              <p className="mt-1 text-xs text-cream-600">{t("sync.baseUrlHint")}</p>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-cream-400/50 pb-3">
              <button
                type="button"
                className={syncSetupMode === "create" ? "sk-btn-primary" : "sk-btn-secondary"}
                disabled={syncBusy}
                onClick={() => {
                  setSyncSetupMode("create");
                  clearSyncFeedback();
                }}
              >
                {t("sync.modeCreate")}
              </button>
              <button
                type="button"
                className={syncSetupMode === "link" ? "sk-btn-primary" : "sk-btn-secondary"}
                disabled={syncBusy}
                onClick={() => {
                  setSyncSetupMode("link");
                  clearSyncFeedback();
                }}
              >
                {t("sync.modeLink")}
              </button>
            </div>

            {syncSetupMode === "create" ? (
              <div className="space-y-4">
                <div>
                  <label className="sk-label" htmlFor="sync-display-create">
                    {t("sync.displayName")}
                  </label>
                  <input
                    id="sync-display-create"
                    className="sk-input"
                    value={syncDisplayName}
                    onChange={(e) => setSyncDisplayName(e.target.value)}
                    placeholder={t("sync.displayNamePlaceholder")}
                  />
                  <p className="mt-1 text-xs text-cream-600">{t("sync.displayNameCreateHint")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="sk-label">{t("sync.passwordCreate")}</label>
                    <input
                      type="password"
                      className="sk-input"
                      autoComplete="new-password"
                      value={syncPasswordNew}
                      onChange={(e) => setSyncPasswordNew(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="sk-label">{t("sync.passwordCreate2")}</label>
                    <input
                      type="password"
                      className="sk-input"
                      autoComplete="new-password"
                      value={syncPasswordNew2}
                      onChange={(e) => setSyncPasswordNew2(e.target.value)}
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-cream-800">
                  <input
                    type="checkbox"
                    checked={syncRemember}
                    onChange={(e) => void handleSyncRememberChange(e.target.checked)}
                  />
                  {t("sync.rememberSession")}
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="sk-btn-primary"
                    disabled={syncBusy}
                    onClick={() => void handleSyncCreateVault()}
                  >
                    {t("sync.btnCreateVault")}
                  </button>
                  <button
                    type="button"
                    className="sk-btn-secondary"
                    disabled={syncBusy}
                    onClick={() => void handleSyncTest()}
                  >
                    {t("sync.btnTestServer")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex cursor-pointer gap-2">
                    <input
                      type="radio"
                      name="sync-link-by"
                      checked={syncLinkBy === "name"}
                      onChange={() => setSyncLinkBy("name")}
                    />
                    {t("sync.linkByName")}
                  </label>
                  <label className="flex cursor-pointer gap-2">
                    <input
                      type="radio"
                      name="sync-link-by"
                      checked={syncLinkBy === "id"}
                      onChange={() => setSyncLinkBy("id")}
                    />
                    {t("sync.linkById")}
                  </label>
                </div>

                {syncLinkBy === "name" ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label className="sk-label" htmlFor="sync-lookup-name">
                        {t("sync.lookupName")}
                      </label>
                      <input
                        id="sync-lookup-name"
                        className="sk-input"
                        value={syncLookupName}
                        onChange={(e) => setSyncLookupName(e.target.value)}
                        placeholder={t("sync.lookupNamePlaceholder")}
                      />
                      <p className="mt-1 text-xs text-cream-600">{t("sync.lookupNameHint")}</p>
                    </div>
                    <button
                      type="button"
                      className="sk-btn-secondary shrink-0"
                      disabled={syncBusy || !syncBaseUrl.trim() || !syncLookupName.trim()}
                      onClick={() => void handleSyncLookupVaultByName()}
                    >
                      {t("sync.btnLookupVault")}
                    </button>
                  </div>
                ) : null}

                <div>
                  <label className="sk-label" htmlFor="sync-vault">
                    {t("sync.vaultId")}
                  </label>
                  <input
                    id="sync-vault"
                    className="sk-input font-mono text-sm"
                    dir="ltr"
                    value={syncVaultId}
                    onChange={(e) => setSyncVaultId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    disabled={syncBusy}
                  />
                  <p className="mt-1 text-xs text-cream-600">{t("sync.vaultIdHint")}</p>
                </div>

                <div>
                  <label className="sk-label" htmlFor="sync-display-link">
                    {t("sync.displayNameLocal")}
                  </label>
                  <input
                    id="sync-display-link"
                    className="sk-input"
                    value={syncDisplayName}
                    onChange={(e) => setSyncDisplayName(e.target.value)}
                    placeholder={t("sync.displayNameLocalPlaceholder")}
                  />
                  <p className="mt-1 text-xs text-cream-600">{t("sync.displayNameLocalHint")}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="sk-btn-primary"
                    disabled={syncBusy}
                    onClick={() => void handleSyncSaveConfig()}
                  >
                    {t("sync.btnSaveConfig")}
                  </button>
                  <button
                    type="button"
                    className="sk-btn-secondary"
                    disabled={syncBusy}
                    onClick={() => void handleSyncTest()}
                  >
                    {t("sync.btnTestServer")}
                  </button>
                </div>
              </div>
            )}
            {(syncBusy || syncMsg) ? (
              <div
                className={
                  syncMsgIsError
                    ? "sk-callout-danger"
                    : syncBusy
                      ? "sk-callout-muted"
                      : "sk-callout-warning"
                }
                role="status"
                aria-live="polite"
              >
                {syncBusy ? (
                  <p className="text-sm font-medium text-cream-950">{t("sync.connecting")}</p>
                ) : null}
                {syncMsg && !syncBusy ? <p className="text-sm leading-relaxed">{syncMsg}</p> : null}
              </div>
            ) : null}
          </section>

          <section className="sk-card space-y-4">
            <h4 className="text-sm font-semibold text-cream-900">{t("sync.password")}</h4>
            <p className="text-xs leading-relaxed text-cream-600">{t("sync.passwordHelp")}</p>
            <input
              type="password"
              className="sk-input max-w-md"
              autoComplete="off"
              value={syncPassword}
              onChange={(e) => setSyncPassword(e.target.value)}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-cream-800">
              <input
                type="checkbox"
                checked={syncRemember}
                onChange={(e) => void handleSyncRememberChange(e.target.checked)}
              />
              {t("sync.rememberSession")}
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="sk-btn-secondary" disabled={syncBusy} onClick={() => void handleSyncUnlock()}>
                {t("sync.btnUnlock")}
              </button>
              <button type="button" className="sk-btn-muted text-sm" disabled={syncBusy} onClick={() => void handleSyncClearSession()}>
                {t("sync.btnClearSession")}
              </button>
            </div>
            {syncSessionOpen ? <p className="text-xs text-sage-700">{t("sync.sessionUnlocked")}</p> : null}
          </section>

          <details className="sk-card space-y-4 open:ring-1 open:ring-cream-400/40">
            <summary className="cursor-pointer list-none text-sm font-semibold text-cream-900 [&::-webkit-details-marker]:hidden">
              {t("sync.advancedTitle")}
            </summary>
            <div className="mt-4 space-y-6 border-t border-cream-400/40 pt-4">
              <p className="text-xs text-cream-600">
                {t("settings.version")}: {APP_VERSION}
              </p>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-cream-900">{t("sync.activityLog")}</h4>
                {syncActivityLog.length === 0 ? (
                  <p className="text-xs text-cream-600">{t("sync.activityLogEmpty")}</p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-cream-800">
                    {syncActivityLog.map((e, i) => (
                      <li key={`${e.at}-${i}`} className="rounded-md bg-cream-200/50 px-2 py-1">
                        <span className="text-cream-600">{new Date(e.at).toLocaleString("ar")}</span>
                        {" — "}
                        {t(`sync.activity.${e.kind}` as "sync.activity.push_ok")}
                        {e.detail ? `: ${e.detail}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-cream-900">{t("sync.remoteHeading")}</h4>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="sk-btn-secondary" disabled={syncBusy} onClick={() => void handleSyncCheckRemote()}>
                    {t("sync.btnCheckRemote")}
                  </button>
                  <button type="button" className="sk-btn-secondary" disabled={syncBusy} onClick={() => void handleSyncPullPreview()}>
                    {t("sync.btnPullPreview")}
                  </button>
                </div>
                {syncRemote ? (
                  <ul className="list-inside list-disc space-y-1 text-sm text-cream-800">
                    <li>{t("sync.remoteRevision", { rev: syncRemote.revision })}</li>
                    <li>
                      {syncRemote.has_snapshot ? t("sync.remoteHasSnapshot") : t("sync.remoteNoSnapshot")}
                    </li>
                    <li>{t("sync.minAppVersion", { v: syncRemote.min_client_semver })}</li>
                    <li>{t("sync.exportVersionLimit", { v: syncRemote.max_backup_export_version })}</li>
                  </ul>
                ) : null}
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-cream-900">{t("sync.btnPushNow")}</h4>
                <p className="text-xs text-cream-600">{t("sync.manualPushHint")}</p>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex cursor-pointer gap-2">
                    <input
                      type="radio"
                      name="sync-scope"
                      checked={syncPushScope === "full"}
                      onChange={() => setSyncPushScope("full")}
                    />
                    {t("sync.scopeFull")}
                  </label>
                  <label className="flex cursor-pointer gap-2">
                    <input
                      type="radio"
                      name="sync-scope"
                      checked={syncPushScope === "without_settings"}
                      onChange={() => setSyncPushScope("without_settings")}
                    />
                    {t("sync.scopeDataOnly")}
                  </label>
                </div>
                <button type="button" className="sk-btn-primary" disabled={syncBusy} onClick={() => void handleSyncPush()}>
                  {syncBusy ? t("sync.busy") : t("sync.btnPushNow")}
                </button>
              </div>
            </div>
          </details>
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
        inlineBackupJson={syncBackupJson}
        onClose={() => {
          if (importApplying) return;
          setImportDlgOpen(false);
          setImportPreview(null);
          setSyncBackupJson(null);
          setSyncPullRevision(null);
        }}
        onApply={(args) => void applyImport(args)}
      />
    </div>
  );
}
