/** Wallet services and card networks — display labels live in `src/locales/ar.json` (`paymentCatalog.*`). */

export interface PaymentServiceOption {
  code: string;
}

export const PAYMENT_SERVICES: PaymentServiceOption[] = [
  { code: "PAYPAL" },
  { code: "STRIPE" },
  { code: "APPLE_PAY" },
  { code: "GOOGLE_PAY" },
  { code: "AMAZON_PAY" },
  { code: "SAMSUNG_PAY" },
  { code: "SKRILL" },
  { code: "NETELLER" },
  { code: "WISE" },
  { code: "REVOLUT" },
  { code: "PAYONEER" },
  { code: "MADA_PAY" },
  { code: "STC_PAY" },
  { code: "OTHER" },
];

export const CARD_BRANDS: { code: string }[] = [
  { code: "VISA" },
  { code: "MASTERCARD" },
  { code: "AMEX" },
  { code: "DISCOVER" },
  { code: "MADA" },
  { code: "DINERS" },
  { code: "JCB" },
  { code: "UNIONPAY" },
  { code: "OTHER" },
];
