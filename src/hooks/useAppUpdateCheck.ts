import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../version";
import { formatUiError } from "../lib/uiErrors";
import {
  dismissUpdate,
  fetchLocalizedReleaseNotes,
  isUpdateDismissed,
  type UpdateCheckState,
} from "../lib/appUpdate";

const UPDATE_POLL_MS = 5 * 60 * 1000;

export function useAppUpdateCheck() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<UpdateCheckState>({ status: "idle" });
  const [dialogOpen, setDialogOpen] = useState(false);

  const check = useCallback(
    async (opts?: { autoPrompt?: boolean; silent?: boolean }) => {
      if (!opts?.silent) {
        setState((s) => ({ ...s, status: "checking", error: undefined }));
      }
      try {
        const r = await window.ishtarkati.checkForUpdates();
        if (!r.ok) {
          if (!opts?.silent) {
            setState({ status: "error", error: r.error });
          }
          return;
        }
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
      }
    },
    [i18n.language, t],
  );

  useEffect(() => {
    void check({ autoPrompt: true });
    const timer = window.setInterval(() => {
      void check({ autoPrompt: true, silent: true });
    }, UPDATE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [check]);

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
