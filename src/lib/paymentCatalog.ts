/** Popular payment services (wallet / gateway) for dropdowns. */

export interface PaymentServiceOption {
  code: string;
  nameAr: string;
}

export const PAYMENT_SERVICES: PaymentServiceOption[] = [
  { code: "PAYPAL", nameAr: "PayPal" },
  { code: "STRIPE", nameAr: "Stripe" },
  { code: "APPLE_PAY", nameAr: "Apple Pay" },
  { code: "GOOGLE_PAY", nameAr: "Google Pay" },
  { code: "AMAZON_PAY", nameAr: "Amazon Pay" },
  { code: "SAMSUNG_PAY", nameAr: "Samsung Pay" },
  { code: "SKRILL", nameAr: "Skrill" },
  { code: "NETELLER", nameAr: "Neteller" },
  { code: "WISE", nameAr: "Wise (TransferWise)" },
  { code: "REVOLUT", nameAr: "Revolut" },
  { code: "PAYONEER", nameAr: "Payoneer" },
  { code: "MADA_PAY", nameAr: "مدى / Mada" },
  { code: "STC_PAY", nameAr: "STC Pay" },
  { code: "OTHER", nameAr: "أخرى / يدوي" },
];

/** Major card networks for manual entry (last 4 + expiry). */
export const CARD_BRANDS: { code: string; nameAr: string }[] = [
  { code: "VISA", nameAr: "Visa" },
  { code: "MASTERCARD", nameAr: "Mastercard" },
  { code: "AMEX", nameAr: "American Express" },
  { code: "DISCOVER", nameAr: "Discover" },
  { code: "MADA", nameAr: "مدى (Mada)" },
  { code: "DINERS", nameAr: "Diners Club" },
  { code: "JCB", nameAr: "JCB" },
  { code: "UNIONPAY", nameAr: "UnionPay" },
  { code: "OTHER", nameAr: "أخرى" },
];
