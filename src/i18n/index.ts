import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./ar.json";

void i18n.use(initReactI18next).init({
  lng: "ar",
  fallbackLng: "ar",
  resources: { ar: { translation: ar } },
  interpolation: { escapeValue: false },
});

export default i18n;
