import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/** عند تشغيل التطبيق: فتح جلسة محفوظة + تنبيه إن وُجدت نسخة أحدث على السيرفر. */
export function useSyncBootstrap() {
  const { t } = useTranslation();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      if (!window.ishtarkati) return;
      await window.ishtarkati.syncTryAutoUnlock?.();
      const chk = await window.ishtarkati.syncCheckRemoteNewer?.();
      if (chk?.ok && chk.newer && window.ishtarkati.showNotification) {
        await window.ishtarkati.showNotification({
          title: t("sync.remoteNewerTitle"),
          body: t("sync.remoteNewerBody", {
            server: chk.serverRevision,
            local: chk.localRevision,
          }),
        });
      }
    })();
  }, [t]);
}
