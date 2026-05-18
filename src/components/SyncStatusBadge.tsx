import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSyncStatus, type SyncStatusState } from "../hooks/useSyncStatus";

const stateClass: Record<SyncStatusState, string> = {
  not_configured: "bg-cream-300/80 text-cream-800",
  locked: "bg-amber-500/20 text-cream-950 ring-1 ring-amber-600/30",
  ready: "bg-sage-600/20 text-sage-900 ring-1 ring-sage-700/25",
  pending: "bg-cream-400/60 text-cream-900 animate-pulse",
  conflict: "bg-red-950/15 text-red-950 ring-1 ring-red-800/35",
};

export function SyncStatusBadge() {
  const { t } = useTranslation();
  const { summary } = useSyncStatus();

  if (!summary) return null;

  const labelKey = `sync.statusBadge.${summary.state}` as const;
  const label = t(labelKey);

  return (
    <Link
      to="/settings?tab=sync"
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-90 ${stateClass[summary.state]}`}
      title={label}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          summary.state === "ready"
            ? "bg-sage-600"
            : summary.state === "conflict"
              ? "bg-red-700"
              : summary.state === "pending"
                ? "bg-cream-700"
                : "bg-amber-600"
        }`}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
