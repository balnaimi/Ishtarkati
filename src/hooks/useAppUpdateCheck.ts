import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../version";
import { formatUiError } from "../lib/uiErrors";
import {
  dismissUpdate,
  fetchLocalizedReleaseNotes,
  isUpdateDismissed,
  type UpdateCheckState,
} from "../lib/appUpdate";

export function useAppUpdateCheck() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<UpdateCheckState>({ status: "idle" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const checkedRef = useRef(false);

  const check = useCallback(
    async (opts?: { autoPrompt?: boolean }) => {
      setState((s) => ({ ...s, status: "checking", error: undefined }));
      try {
        const r = await window.ishtarkati.checkForUpdates();
        if (!r.ok) {
          setState({ status: "error", error: r.error });
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
        setState({ status: "error", error: formatUiError(t, e) });
      }
    },
    [i18n.language, t],
  );

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    void check({ autoPrompt: true });
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
