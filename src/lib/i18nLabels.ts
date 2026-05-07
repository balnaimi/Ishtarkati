import type { TFunction } from "i18next";

/** Arabic (or future locale) display name for an ISO 4217 code. */
export function tCurrency(t: TFunction, code: string): string {
  const c = code.trim().toUpperCase();
  return String(t(`currencies.${c}`, { defaultValue: c }));
}

export function tPaymentService(t: TFunction, code: string): string {
  return String(t(`paymentCatalog.services.${code}`, { defaultValue: code }));
}

export function tCardBrand(t: TFunction, code: string): string {
  return String(t(`paymentCatalog.brands.${code}`, { defaultValue: code }));
}
