import { useEffect, useState } from "react";
import i18n from "../i18n";
import { applyDocumentLocale, loadAppLocale } from "../lib/appLocale";
import { loadAndApplyTheme } from "../lib/theme";
import { LoadingScreen } from "./LoadingScreen";

/** Sync i18n + document lang/dir + theme from DB before the main UI. */
export function LocaleBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const locale = await loadAppLocale();
      if (i18n.language !== locale) {
        await i18n.changeLanguage(locale);
      }
      applyDocumentLocale(locale);
      await loadAndApplyTheme();
      setReady(true);
    })();
  }, []);

  if (!ready) return <LoadingScreen />;
  return <>{children}</>;
}
