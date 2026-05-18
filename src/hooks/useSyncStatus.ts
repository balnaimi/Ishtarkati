import { useCallback, useEffect, useState } from "react";

export type SyncStatusState =
  | "not_configured"
  | "locked"
  | "ready"
  | "pending"
  | "conflict";

export type SyncStatusSummary = {
  state: SyncStatusState;
  configured: boolean;
  sessionUnlocked: boolean;
  rememberEnabled: boolean;
  localRevision: string;
  displayName: string;
  lastActivity: { at: string; kind: string; detail?: string } | null;
};

export function useSyncStatus(pollMs = 12_000) {
  const [summary, setSummary] = useState<SyncStatusSummary | null>(null);

  const refresh = useCallback(async () => {
    if (!window.ishtarkati?.syncGetStatusSummary) return;
    const r = await window.ishtarkati.syncGetStatusSummary();
    if (r.ok) {
      setSummary({
        state: r.state,
        configured: r.configured,
        sessionUnlocked: r.sessionUnlocked,
        rememberEnabled: r.rememberEnabled,
        localRevision: r.localRevision,
        displayName: r.displayName,
        lastActivity: r.lastActivity,
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [pollMs, refresh]);

  return { summary, refresh };
}
