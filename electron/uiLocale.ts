import localeAr from "../src/locales/ar.json";
import localeEn from "../src/locales/en.json";
import type Database from "better-sqlite3";

export type UiLocale = "ar" | "en";

const APP_LANGUAGE_KEY = "app_language";

export function readUiLocale(database: Database.Database | null): UiLocale {
  if (!database) return "ar";
  try {
    const row = database
      .prepare("SELECT value FROM settings WHERE key = ? LIMIT 1")
      .get(APP_LANGUAGE_KEY) as { value: string } | undefined;
    return row?.value === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function electronUiStrings(database: Database.Database | null): (typeof localeAr)["electron"] {
  return readUiLocale(database) === "en" ? localeEn.electron : localeAr.electron;
}
