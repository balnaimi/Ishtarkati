import { useTranslation } from "react-i18next";
import {
  isAutoBackupStatusBusy,
  type AutoBackupStatusSnapshot,
} from "../hooks/useAutoBackupStatus";

type Props = {
  status: AutoBackupStatusSnapshot;
};

function dotClass(phase: AutoBackupStatusSnapshot["phase"]): string {
  if (phase === "pending" || phase === "running") {
    return "size-2 shrink-0 animate-pulse rounded-full bg-orange-400";
  }
  if (phase === "error") {
    return "size-2 shrink-0 rounded-full bg-red-500";
  }
  return "size-2 shrink-0 rounded-full bg-sage-500";
}

function labelKey(phase: AutoBackupStatusSnapshot["phase"]): string {
  if (phase === "pending" || phase === "running") return "layout.autoBackupStatusRunning";
  if (phase === "ok") return "layout.autoBackupStatusOk";
  if (phase === "error") return "layout.autoBackupStatusError";
  return "layout.autoBackupStatusReady";
}

export function FooterAutoBackupStatus({ status }: Props) {
  const { t } = useTranslation();

  if (status.phase === "hidden") return null;

  const busy = isAutoBackupStatusBusy(status.phase);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-cream-700"
      title={status.phase === "error" && status.error ? status.error : undefined}
      aria-live="polite"
    >
      <span className={dotClass(status.phase)} aria-hidden />
      <span className={busy ? "text-orange-800 dark:text-orange-200" : undefined}>
        {t(labelKey(status.phase))}
      </span>
    </span>
  );
}
