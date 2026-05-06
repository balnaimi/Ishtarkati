import { useCallback, useEffect, useState } from "react";
import { getSetting, ONBOARDING_COMPLETE_KEY } from "../db/repo";
import { LoadingScreen } from "./LoadingScreen";
import { OnboardingWizard } from "./OnboardingWizard";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState<"check" | "done" | "pending">("check");

  const recheck = useCallback(async () => {
    try {
      const v = await getSetting(ONBOARDING_COMPLETE_KEY);
      setReady(v === "1" ? "done" : "pending");
    } catch {
      setReady("pending");
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  if (ready === "check") {
    return <LoadingScreen />;
  }

  if (ready === "pending") {
    return <OnboardingWizard onComplete={() => void recheck()} />;
  }

  return <>{children}</>;
}
