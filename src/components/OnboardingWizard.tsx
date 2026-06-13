import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  APP_LANGUAGE_KEY,
  getSetting,
  insertWalletMethod,
  ONBOARDING_COMPLETE_KEY,
  PIN_ENABLED_KEY,
  PRIMARY_CURRENCY_KEY,
  setSetting,
} from "../db/repo";
import { markSkipNextPinLock } from "../lib/pinSession";
import { listCurrenciesSorted } from "../lib/currenciesData";
import { tCurrency, tPaymentService } from "../lib/i18nLabels";
import { PAYMENT_SERVICES } from "../lib/paymentCatalog";
import { ISHTARKATI_MARK_SRC } from "../lib/publicAssets";
import { type AppLocale, isAppLocale, persistAppLocale } from "../lib/appLocale";
import { useUiDir } from "../hooks/useUiDir";

type Step = "language" | "welcome" | "currency" | "pin" | "payment";

const ONBOARDING_STEPS: readonly Step[] = ["language", "welcome", "currency", "pin", "payment"];

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const dir = useUiDir();
  const [step, setStep] = useState<Step>("language");
  const currencies = useMemo(() => listCurrenciesSorted(), []);
  const [currencyCode, setCurrencyCode] = useState(() => currencies[0]?.code ?? "QAR");

  const [wantPin, setWantPin] = useState(false);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [payService, setPayService] = useState(PAYMENT_SERVICES[0]?.code ?? "OTHER");
  const [payAccount, setPayAccount] = useState("");
  const [payErr, setPayErr] = useState<string | null>(null);

  useEffect(() => {
    void getSetting(APP_LANGUAGE_KEY).then((saved) => {
      if (isAppLocale(saved)) setStep("welcome");
    });
  }, []);

  async function pickLanguage(locale: AppLocale) {
    setBusy(true);
    try {
      await persistAppLocale(locale);
      setStep("welcome");
    } finally {
      setBusy(false);
    }
  }

  async function savePrimaryAndContinue() {
    await setSetting(PRIMARY_CURRENCY_KEY, currencyCode.trim().toUpperCase());
    setStep("pin");
  }

  async function finishOnboarding() {
    setBusy(true);
    try {
      await setSetting(ONBOARDING_COMPLETE_KEY, "1");
      onComplete();
    } finally {
      setBusy(false);
    }
  }

  async function goFromPin() {
    setPinErr(null);
    if (pin1.length < 4) {
      setPinErr(t("pin.tooShort"));
      return;
    }
    if (pin1 !== pin2) {
      setPinErr(t("pin.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const r = await window.ishtarkati.setPin(pin1);
      if (!r.ok) {
        setPinErr(t("pin.setFailed"));
        return;
      }
      await setSetting(PIN_ENABLED_KEY, "1");
      markSkipNextPinLock();
      setPin1("");
      setPin2("");
      setStep("payment");
    } finally {
      setBusy(false);
    }
  }

  async function addWalletAndFinish() {
    const acc = payAccount.trim();
    if (!acc) {
      setPayErr(t("onboarding.paymentAccountRequired"));
      return;
    }
    setPayErr(null);
    setBusy(true);
    try {
      await insertWalletMethod({
        service_code: payService,
        account_text: acc,
        linked_card_id: null,
      });
      await finishOnboarding();
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = Math.max(0, ONBOARDING_STEPS.indexOf(step));

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-cream-50" dir={dir}>
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-10">
        <div className="mb-6 flex justify-center gap-2">
          {ONBOARDING_STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-2 w-8 rounded-full ${i <= stepIndex ? "bg-sage-600" : "bg-cream-400"}`}
            />
          ))}
        </div>

        <div className="sk-card space-y-5 border-cream-400/80 shadow-lg">
          {step === "language" ? (
            <>
              <h1 className="text-center text-2xl font-bold text-cream-900">
                {t("onboarding.languageTitle")}
              </h1>
              <p className="text-center text-sm leading-relaxed text-cream-800">
                {t("onboarding.languageHint")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="sk-btn-primary py-4 text-lg"
                  disabled={busy}
                  onClick={() => void pickLanguage("ar")}
                >
                  {t("onboarding.languageArabic")}
                </button>
                <button
                  type="button"
                  className="sk-btn-secondary py-4 text-lg"
                  disabled={busy}
                  onClick={() => void pickLanguage("en")}
                >
                  {t("onboarding.languageEnglish")}
                </button>
              </div>
            </>
          ) : null}

          {step === "welcome" ? (
            <>
              <div className="flex justify-center">
                <img
                  src={ISHTARKATI_MARK_SRC}
                  alt=""
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-2xl shadow-md ring-1 ring-cream-400/80"
                  decoding="async"
                />
              </div>
              <h1 className="text-center text-2xl font-bold text-cream-900">{t("onboarding.welcomeTitle")}</h1>
              <p className="text-center text-sm leading-relaxed text-cream-800">{t("onboarding.welcomeBody")}</p>
              <button type="button" className="sk-btn-primary w-full py-3 text-base" onClick={() => setStep("currency")}>
                {t("onboarding.start")}
              </button>
            </>
          ) : null}

          {step === "currency" ? (
            <>
              <h2 className="text-xl font-semibold text-cream-900">{t("onboarding.currencyTitle")}</h2>
              <p className="text-sm leading-relaxed text-cream-800">{t("onboarding.currencyHint")}</p>
              <select
                className="sk-select text-base"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code} — {tCurrency(t, c.code)}
                  </option>
                ))}
              </select>
              <div className="flex gap-3">
                <button type="button" className="sk-btn-secondary flex-1" onClick={() => setStep("welcome")}>
                  {t("common.back")}
                </button>
                <button
                  type="button"
                  className="sk-btn-primary flex-1"
                  onClick={() => void savePrimaryAndContinue()}
                >
                  {t("onboarding.continue")}
                </button>
              </div>
            </>
          ) : null}

          {step === "pin" ? (
            <>
              <h2 className="text-xl font-semibold text-cream-900">{t("onboarding.pinTitle")}</h2>
              <p className="text-sm leading-relaxed text-cream-800">{t("onboarding.pinHint")}</p>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-cream-800">
                <input
                  type="checkbox"
                  className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
                  checked={wantPin}
                  onChange={(e) => {
                    setWantPin(e.target.checked);
                    setPinErr(null);
                  }}
                />
                {t("onboarding.pinEnableChoice")}
              </label>
              {wantPin ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="sk-label">{t("settings.pinOnce")}</label>
                    <input
                      type="password"
                      className="sk-input"
                      inputMode="numeric"
                      value={pin1}
                      onChange={(e) => setPin1(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    />
                  </div>
                  <div>
                    <label className="sk-label">{t("settings.pinTwice")}</label>
                    <input
                      type="password"
                      className="sk-input"
                      inputMode="numeric"
                      value={pin2}
                      onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    />
                  </div>
                </div>
              ) : null}
              {pinErr ? <p className="sk-text-error text-sm">{pinErr}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" className="sk-btn-secondary sm:flex-1" onClick={() => setStep("currency")} disabled={busy}>
                  {t("common.back")}
                </button>
                {wantPin ? (
                  <button type="button" className="sk-btn-primary sm:flex-1" disabled={busy} onClick={() => void goFromPin()}>
                    {t("onboarding.continue")}
                  </button>
                ) : (
                  <button type="button" className="sk-btn-primary sm:flex-1" disabled={busy} onClick={() => setStep("payment")}>
                    {t("onboarding.skipPin")}
                  </button>
                )}
              </div>
            </>
          ) : null}

          {step === "payment" ? (
            <>
              <h2 className="text-xl font-semibold text-cream-900">{t("onboarding.paymentTitle")}</h2>
              <p className="text-sm leading-relaxed text-cream-800">{t("onboarding.paymentHint")}</p>
              <div>
                <label className="sk-label">{t("payment.serviceName")}</label>
                <select className="sk-select" value={payService} onChange={(e) => setPayService(e.target.value)}>
                  {PAYMENT_SERVICES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {tPaymentService(t, s.code)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sk-label">{t("payment.accountOnService")}</label>
                <input
                  className="sk-input"
                  value={payAccount}
                  onChange={(e) => {
                    setPayAccount(e.target.value);
                    setPayErr(null);
                  }}
                  placeholder={t("onboarding.paymentAccountPlaceholder")}
                />
              </div>
              {payErr ? <p className="sk-text-error text-sm">{payErr}</p> : null}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className="sk-btn-secondary w-full"
                  disabled={busy}
                  onClick={() => void finishOnboarding()}
                >
                  {t("onboarding.skipPayment")}
                </button>
                <button
                  type="button"
                  className="sk-btn-primary w-full"
                  disabled={busy}
                  onClick={() => void addWalletAndFinish()}
                >
                  {t("onboarding.addPaymentAndFinish")}
                </button>
              </div>
              <button
                type="button"
                className="w-full text-sm text-cream-700 underline decoration-cream-500"
                onClick={() => setStep("pin")}
              >
                {t("common.back")}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
