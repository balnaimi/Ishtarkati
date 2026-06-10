import { useTranslation } from "react-i18next";
import { PaymentMethodsPanel } from "../components/PaymentMethodsPanel";

export function PaymentMethodsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-cream-900">{t("payment.pageTitle")}</h2>
        <p className="sk-text-hint mt-1 text-sm">{t("payment.pageSubtitle")}</p>
      </div>
      <PaymentMethodsPanel />
    </div>
  );
}
