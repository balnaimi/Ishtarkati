import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../version";
import { formatUiError } from "../lib/uiErrors";
import {
  dismissUpdate,
  fetchLocalizedReleaseNotes,
  isUpdateDismissed,
  UPDATE_POLL_MS,
  UPDATE_RETRY_DELAYS_MS,
  type UpdateCheckState,
} from "../lib/appUpdate";

export function useAppUpdateCheck() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<UpdateCheckState>({ status: "idle" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const inFlightRef = useRef(false);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleRetry = useCallback(
    (run: () => void) => {
      clearRetryTimer();
      const idx = Math.min(retryAttemptRef.current, UPDATE_RETRY_DELAYS_MS.length - 1);
      const delay = UPDATE_RETRY_DELAYS_MS[idx];
      retryAttemptRef.current += 1;
      retryTimerRef.current = window.setTimeout(run, delay);
    },
    [clearRetryTimer],
  );

  const check = useCallback(
    async (opts?: { autoPrompt?: boolean; silent?: boolean }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!opts?.silent) {
        setState((s) => ({ ...s, status: "checking", error: undefined }));
      }
      try {
        const r = await window.ishtarkati.checkForUpdates();
        if (!r.ok) {
          if (!opts?.silent) {
            setState({ status: "error", error: r.error });
          }
          scheduleRetry(() => {
            void check({ autoPrompt: true, silent: true });
          });
          return;
        }

        retryAttemptRef.current = 0;
        clearRetryTimer();

        const localized = await fetchLocalizedReleaseNotes(
          r.latest,
          i18n.language,
          r.notes || t("updates.noNotes"),
        );
        const next: UpdateCheckState = {
          status: r.updateAvailable ? "available" : "current",
          latest: r.latest,
          downloadUrl: r.downloadUrl,
          releaseUrl: r.url,
          notes: localized.text,
          notesLocale: localized.locale,
        };
        setState(next);
        if (opts?.autoPrompt && r.updateAvailable && !isUpdateDismissed(r.latest)) {
          setDialogOpen(true);
        }
      } catch (e) {
        if (!opts?.silent) {
          setState({ status: "error", error: formatUiError(t, e) });
        }
        scheduleRetry(() => {
          void check({ autoPrompt: true, silent: true });
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [clearRetryTimer, i18n.language, scheduleRetry, t],
  );

  useEffect(() => {
    void check({ autoPrompt: true });
    const pollTimer = window.setInterval(() => {
      retryAttemptRef.current = 0;
      void check({ autoPrompt: true, silent: true });
    }, UPDATE_POLL_MS);
    return () => {
      window.clearInterval(pollTimer);
      clearRetryTimer();
    };
  }, [check, clearRetryTimer]);

  const dismissDialog = useCallback(() => {
    if (state.latest) dismissUpdate(state.latest);
    setDialogOpen(false);
  }, [state.latest]);

  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  return {
    state,
    dialogOpen,
    setDialogOpen,
    check,
    dismissDialog,
    openDialog,
    currentVersion: APP_VERSION,
  };
}
