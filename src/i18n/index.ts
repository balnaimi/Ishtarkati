import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "../locales/ar.json";
import currenciesAr from "../locales/currencies.ar.json";

/** Single Arabic UI bundle: screens + ISO 4217 names + payment labels (codes/keys in English). */
const translation = { ...ar, currencies: currenciesAr };

void i18n.use(initReactI18next).init({
  lng: "ar",
  fallbackLng: "ar",
  resources: { ar: { translation } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
