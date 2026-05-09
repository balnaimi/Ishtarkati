import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { runDesktopReminders } from "../lib/desktopReminders";

/** Runs once after shell load (after DB is available). */
export function useDesktopReminders(): void {
  const { t } = useTranslation();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void runDesktopReminders(t);
  }, [t]);
}
