/** Domain types and enums — code in English per project convention. */

/** Where the user registers / signs in: website, app, or both. */
export type PlatformType = "website" | "app" | "both";

export type RecoveryContactKind = "email" | "phone";

export type BillingModel = "one_time" | "recurring" | "free_account";

/** Billing step for recurring subscriptions. */
export type IntervalUnit = "day" | "week" | "month" | "year";

export interface Category {
  id: number;
  name: string;
  sort_order: number;
}

export interface Tag {
  id: number;
  name: string;
  sort_order: number;
}

export interface CreditCard {
  id: number;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  /** Optional note to tell apart cards with the same brand/last4 pattern (name, perks, etc.). */
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletMethod {
  id: number;
  service_code: string;
  account_text: string;
  linked_card_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: number;
  title: string;
  notes: string | null;
  website_url: string | null;
  category_id: number | null;
  billing_model: BillingModel;
  interval_unit: IntervalUnit | null;
  interval_months: number | null;
  interval_count: number;
  auto_renew: number;
  amount_original: number;
  currency_code: string;
  amount_qar_snapshot: number | null;
  fx_rate_used: number | null;
  fx_quote_at: string | null;
  start_date: string | null;
  next_due_date: string | null;
  end_date: string | null;
  is_domain: number;
  /** Comma-separated tags (optional). */
  tags: string | null;
  /** Trial end date (YYYY-MM-DD) when subscription is in trial. */
  trial_ends_on: string | null;
  /** When 1, user cancelled auto-renewal but account may still be active until period ends. */
  renewal_cancelled: number;
  /** User-defined label for the logged-in / family account (optional). */
  account_label: string | null;
  /** website | app | both — where the account is registered. */
  platform_type: PlatformType;
  /** Login username when the service supports it (optional). */
  login_username: string | null;
  /** Login phone number (optional). */
  login_phone: string | null;
  /** Email or phone used for account recovery (optional). */
  recovery_contact: string | null;
  /** Kind of recovery_contact: email or phone. */
  recovery_contact_kind: RecoveryContactKind | null;
  /** When set (YYYY-MM-DD), subscription is treated as cancelled / inactive (history). */
  cancelled_at: string | null;
  credit_card_id: number | null;
  wallet_method_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentEvent {
  id: number;
  subscription_id: number;
  paid_at: string;
  amount_original: number | null;
  currency: string | null;
  amount_qar: number | null;
  /** Legacy: was used for multi-year domain renewals; prefer `renewal_step_count`. */
  renewal_years: number | null;
  /** How many billing steps (each step = subscription `interval_unit`) this payment extended coverage. */
  renewal_step_count: number | null;
  note: string | null;
}

export interface SubscriptionFormValues {
  title: string;
  notes: string;
  website_url: string;
  category_id: string;
  billing_model: BillingModel;
  interval_unit: IntervalUnit | "";
  interval_count: string;
  auto_renew: boolean;
  amount_original: string;
  currency_code: string;
  start_date: string;
  next_due_date: string;
  end_date: string;
  account_label: string;
  platform_type: PlatformType;
  login_username: string;
  login_phone: string;
  recovery_contact: string;
  recovery_contact_kind: RecoveryContactKind | "";
  wallet_method_id: string;
  credit_card_id: string;
  tags: string;
  trial_ends_on: string;
  renewal_cancelled: boolean;
}

export interface SubscriptionAuditEntry {
  id: number;
  subscription_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}
