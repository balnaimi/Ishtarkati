/** Domain types and enums — code in English per project convention. */

export type BillingModel = "one_time" | "recurring" | "pay_as_needed";

export type IntervalUnit = "month" | "quarter" | "year" | "custom_months";

export interface Category {
  id: number;
  name: string;
  sort_order: number;
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
  tags: string | null;
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
  renewal_years: number | null;
  note: string | null;
}

export interface SubscriptionFormValues {
  title: string;
  notes: string;
  website_url: string;
  category_id: string;
  billing_model: BillingModel;
  interval_unit: IntervalUnit | "";
  interval_months: string;
  auto_renew: boolean;
  amount_original: string;
  currency_code: string;
  start_date: string;
  next_due_date: string;
  end_date: string;
  is_domain: boolean;
  tags: string;
}
