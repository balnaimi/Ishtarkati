import { useTranslation } from "react-i18next";
import { PaymentMethodsPanel } from "../components/PaymentMethodsPanel";

export function PaymentMethodsPage() {
  const { t } = useTranslation();

  return (
    <div className="dash-page">
      <header>
        <h1 className="dash-page-title">{t("payment.pageTitle")}</h1>
        <p className="dash-page-sub">{t("payment.pageSubtitle")}</p>
      </header>
      <PaymentMethodsPanel />
    </div>
  );
}
