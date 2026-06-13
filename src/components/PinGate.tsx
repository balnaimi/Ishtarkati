import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSetting, PIN_ENABLED_KEY } from "../db/repo";
import { consumeSkipNextPinLock } from "../lib/pinSession";
import { LoadingScreen } from "./LoadingScreen";

export function PinGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"check" | "open" | "locked">("check");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const enabled = await getSetting(PIN_ENABLED_KEY);
      if (cancelled) return;
      if (enabled !== "1") {
        setPhase("open");
        return;
      }
      if (consumeSkipNextPinLock()) {
        setPhase("open");
        return;
      }
      const st = await window.ishtarkati.pinStatus();
      if (cancelled) return;
      if (!st.hasPin) {
        setPhase("open");
        return;
      }
      setPhase("locked");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function tryUnlock() {
    setErr(null);
    const ok = await window.ishtarkati.verifyPin(pin);
    if (ok) {
      setPhase("open");
      setPin("");
    } else {
      setErr(t("pin.wrong"));
    }
  }

  if (phase === "check") {
    return <LoadingScreen />;
  }

  if (phase === "open") {
    return <>{children}</>;
  }

  return (
    <div className="sk-modal-overlay p-4">
      <div
        className="sk-dialog-panel w-full max-w-sm p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-gate-title"
      >
        <p id="pin-gate-title" className="text-center text-lg font-semibold text-cream-950">
          {t("pin.title")}
        </p>
        <p className="sk-text-hint mt-2 text-center text-sm">{t("pin.subtitle")}</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          className="sk-input mt-5 text-center text-2xl tracking-[0.4em]"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void tryUnlock();
          }}
          aria-label={t("pin.title")}
        />
        {err ? <p className="sk-text-error mt-3 text-center text-sm">{err}</p> : null}
        <button type="button" className="sk-btn-primary mt-5 w-full" onClick={() => void tryUnlock()}>
          {t("pin.unlock")}
        </button>
      </div>
    </div>
  );
}
