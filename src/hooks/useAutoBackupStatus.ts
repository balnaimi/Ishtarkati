import { useEffect, useState } from "react";

export type AutoBackupStatusPhase =
  | "hidden"
  | "ready"
  | "pending"
  | "running"
  | "ok"
  | "error";

export type AutoBackupStatusSnapshot = {
  phase: AutoBackupStatusPhase;
  updatedAt: string;
  error?: string;
};

export function isAutoBackupStatusBusy(phase: AutoBackupStatusPhase): boolean {
  return phase === "pending" || phase === "running";
}

export function useAutoBackupStatus(): AutoBackupStatusSnapshot {
  const [status, setStatus] = useState<AutoBackupStatusSnapshot>({
    phase: "hidden",
    updatedAt: "",
  });

  useEffect(() => {
    void window.ishtarkati.refreshAutoBackupStatus().then(setStatus);
    return window.ishtarkati.onAutoBackupStatusChanged(setStatus);
  }, []);

  return status;
}
