import { useTranslation } from "react-i18next";

/** Document text direction for the active UI language. */
export function useUiDir(): "rtl" | "ltr" {
  const { i18n } = useTranslation();
  return i18n.language === "ar" ? "rtl" : "ltr";
}
