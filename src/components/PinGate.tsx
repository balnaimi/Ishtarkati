import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSetting } from "../db/repo";

export function PinGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"check" | "open" | "locked">("check");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const enabled = await getSetting("pin_enabled");
      if (cancelled) return;
      if (enabled !== "1") {
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
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-cream-700">
        {t("common.loading")}
      </div>
    );
  }

  if (phase === "open") {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-b from-cream-900/95 via-walnut-900/90 to-cream-950 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-cream-400/40 bg-cream-50/95 p-8 shadow-2xl">
        <p className="text-center text-lg font-semibold text-cream-900">{t("pin.title")}</p>
        <p className="mt-2 text-center text-sm text-cream-700">{t("pin.subtitle")}</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          className="sk-input mt-6 text-center text-2xl tracking-[0.4em]"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void tryUnlock();
          }}
          aria-label={t("pin.title")}
        />
        {err ? <p className="mt-3 text-center text-sm text-red-800">{err}</p> : null}
        <button type="button" className="sk-btn-primary mt-6 w-full py-3" onClick={() => void tryUnlock()}>
          {t("pin.unlock")}
        </button>
      </div>
    </div>
  );
}
