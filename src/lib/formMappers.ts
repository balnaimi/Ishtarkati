import type { SubscriptionFormValues, Subscription, IntervalUnit, BillingModel } from "../types";

export function defaultFormValues(): SubscriptionFormValues {
  return {
    title: "",
    notes: "",
    website_url: "",
    category_id: "",
    billing_model: "recurring",
    interval_unit: "month",
    interval_months: "3",
    auto_renew: true,
    amount_original: "0",
    currency_code: "USD",
    start_date: "",
    next_due_date: "",
    end_date: "",
    is_domain: false,
  };
}

export function subscriptionToForm(s: Subscription): SubscriptionFormValues {
  return {
    title: s.title,
    notes: s.notes ?? "",
    website_url: s.website_url ?? "",
    category_id: s.category_id != null ? String(s.category_id) : "",
    billing_model: s.billing_model as BillingModel,
    interval_unit: (s.interval_unit as IntervalUnit) ?? "",
    interval_months: s.interval_months != null ? String(s.interval_months) : "3",
    auto_renew: Boolean(s.auto_renew),
    amount_original: String(s.amount_original),
    currency_code: s.currency_code,
    start_date: s.start_date?.slice(0, 10) ?? "",
    next_due_date: s.next_due_date?.slice(0, 10) ?? "",
    end_date: s.end_date?.slice(0, 10) ?? "",
    is_domain: Boolean(s.is_domain),
  };
}

export function formToRow(
  v: SubscriptionFormValues,
  qar: number,
  fxFactor: number,
  fxAt: string,
): {
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
} {
  const amt = parseFloat(v.amount_original.replace(",", "."));
  const interval_unit: IntervalUnit | null =
    v.billing_model === "recurring" && v.interval_unit ? v.interval_unit : null;
  let interval_months: number | null = null;
  if (interval_unit === "custom_months") {
    interval_months = parseInt(v.interval_months, 10) || null;
  }
  return {
    title: v.title.trim(),
    notes: v.notes.trim() || null,
    website_url: v.website_url.trim() || null,
    category_id: v.category_id ? parseInt(v.category_id, 10) : null,
    billing_model: v.billing_model,
    interval_unit,
    interval_months,
    auto_renew: v.auto_renew ? 1 : 0,
    amount_original: amt,
    currency_code: (v.currency_code || "USD").toUpperCase(),
    amount_qar_snapshot: qar,
    fx_rate_used: fxFactor,
    fx_quote_at: fxAt,
    start_date: v.start_date.trim() || null,
    next_due_date: v.next_due_date.trim() || null,
    end_date: v.end_date.trim() || null,
    is_domain: v.is_domain ? 1 : 0,
  };
}
