import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "../locales/ar.json";
import en from "../locales/en.json";
import currenciesAr from "../locales/currencies.ar.json";
import currenciesEn from "../locales/currencies.en.json";
import { APP_LOCALE_STORAGE_KEY, applyDocumentLocale, isAppLocale } from "../lib/appLocale";

function bundle(ui: typeof ar, currencies: typeof currenciesAr) {
  return { ...ui, currencies };
}

const cached =
  typeof localStorage !== "undefined" ? localStorage.getItem(APP_LOCALE_STORAGE_KEY) : null;
const initialLng = isAppLocale(cached) ? cached : "ar";

if (typeof document !== "undefined") {
  applyDocumentLocale(initialLng);
}

void i18n.use(initReactI18next).init({
  lng: initialLng,
  fallbackLng: "ar",
  resources: {
    ar: { translation: bundle(ar, currenciesAr) },
    en: { translation: bundle(en, currenciesEn) },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
