import { useTranslation } from "react-i18next";

export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-full items-center justify-center p-8 sk-text-hint">
      {t("common.loading")}
    </div>
  );
}
