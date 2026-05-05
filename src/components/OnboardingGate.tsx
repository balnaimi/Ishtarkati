import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSetting, ONBOARDING_COMPLETE_KEY } from "../db/repo";
import { OnboardingWizard } from "./OnboardingWizard";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState<"check" | "done" | "pending">("check");

  const recheck = useCallback(async () => {
    const v = await getSetting(ONBOARDING_COMPLETE_KEY);
    setReady(v === "1" ? "done" : "pending");
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  if (ready === "check") {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-cream-700">
        {t("common.loading")}
      </div>
    );
  }

  if (ready === "pending") {
    return <OnboardingWizard onComplete={() => void recheck()} />;
  }

  return <>{children}</>;
}
