import i18n from "../i18n";
import { APP_LANGUAGE_KEY, getSetting, setSetting } from "../db/repo";

export type AppLocale = "ar" | "en";

export { APP_LANGUAGE_KEY };

export const APP_LOCALE_STORAGE_KEY = "ishtarkati_lang";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "ar" || value === "en";
}

export function applyDocumentLocale(locale: AppLocale): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === "ar" ? "rtl" : "ltr";
}

export function cacheAppLocale(locale: AppLocale): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale);
  }
}

export function readCachedAppLocale(): AppLocale | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(APP_LOCALE_STORAGE_KEY);
  return isAppLocale(v) ? v : null;
}

/** Persist locale to DB + localStorage and switch i18n + document direction. */
export async function persistAppLocale(locale: AppLocale): Promise<void> {
  cacheAppLocale(locale);
  await setSetting(APP_LANGUAGE_KEY, locale);
  await i18n.changeLanguage(locale);
  applyDocumentLocale(locale);
}

export async function loadAppLocale(): Promise<AppLocale> {
  try {
    const fromDb = await getSetting(APP_LANGUAGE_KEY);
    if (isAppLocale(fromDb)) {
      cacheAppLocale(fromDb);
      return fromDb;
    }
  } catch {
    /* DB not ready yet */
  }
  return readCachedAppLocale() ?? "ar";
}
