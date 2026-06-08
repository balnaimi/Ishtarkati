import type { SubscriptionFormValues, Subscription, IntervalUnit, BillingModel } from "../types";
import { addBillingSteps, formatDateInput, parseDateInput } from "./schedule";

export function defaultFormValues(): SubscriptionFormValues {
  return {
    title: "",
    notes: "",
    website_url: "",
    category_id: "",
    billing_model: "recurring",
    interval_unit: "month",
    interval_count: "1",
    auto_renew: true,
    amount_original: "",
    currency_code: "",
    start_date: "",
    next_due_date: "",
    end_date: "",
    account_label: "",
    wallet_method_id: "",
    credit_card_id: "",
  };
}

/** Defaults for a free online account (no payment, no due dates). */
export function defaultFreeAccountFormValues(primaryCurrencyCode: string): SubscriptionFormValues {
  return {
    ...defaultFormValues(),
    billing_model: "free_account",
    interval_unit: "",
    interval_count: "1",
    auto_renew: false,
    amount_original: "0",
    currency_code: primaryCurrencyCode.trim().toUpperCase() || "QAR",
    wallet_method_id: "",
    credit_card_id: "",
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
    interval_count: String(Math.max(1, s.interval_count ?? 1)),
    auto_renew: Boolean(s.auto_renew),
    amount_original: String(s.amount_original),
    currency_code: s.currency_code,
    start_date: s.start_date?.slice(0, 10) ?? "",
    next_due_date: s.next_due_date?.slice(0, 10) ?? "",
    end_date: s.end_date?.slice(0, 10) ?? "",
    account_label: s.account_label ?? "",
    wallet_method_id: s.wallet_method_id != null ? String(s.wallet_method_id) : "",
    credit_card_id:
      s.wallet_method_id != null
        ? ""
        : s.credit_card_id != null
          ? String(s.credit_card_id)
          : "",
  };
}

/** First next due for new recurring row from start date and interval. */
export function computeNextDueForNewRecurring(v: SubscriptionFormValues): string | null {
  if (v.billing_model !== "recurring" || !v.interval_unit) return null;
  const start = parseDateInput(v.start_date);
  if (!start) return null;
  const cnt = parseInt(v.interval_count, 10) || 1;
  const next = addBillingSteps(start, v.interval_unit as IntervalUnit, cnt);
  return formatDateInput(next);
}

export function formToRow(
  v: SubscriptionFormValues,
  primaryAmount: number,
  fxFactor: number,
  fxAt: string,
  existing?: Subscription | null,
): {
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
  account_label: string | null;
  credit_card_id: number | null;
  wallet_method_id: number | null;
} {
  const isFree = v.billing_model === "free_account";
  const amt = isFree ? 0 : parseFloat(v.amount_original.replace(",", "."));
  const interval_unit: IntervalUnit | null =
    v.billing_model === "recurring" && v.interval_unit ? v.interval_unit : null;
  const interval_count =
    v.billing_model === "recurring"
      ? Math.max(1, parseInt(v.interval_count, 10) || 1)
      : 1;

  if (isFree) {
    return {
      title: v.title.trim(),
      notes: v.notes.trim() || null,
      website_url: v.website_url.trim() || null,
      category_id: v.category_id ? parseInt(v.category_id, 10) : null,
      billing_model: "free_account",
      interval_unit: null,
      interval_months: null,
      interval_count: 1,
      auto_renew: 0,
      amount_original: 0,
      currency_code: v.currency_code.trim().toUpperCase() || "QAR",
      amount_qar_snapshot: 0,
      fx_rate_used: 1,
      fx_quote_at: fxAt,
      start_date: v.start_date.trim() || null,
      next_due_date: null,
      end_date: null,
      is_domain: 0,
      account_label: v.account_label.trim() || null,
      credit_card_id: null,
      wallet_method_id: null,
    };
  }

  let next_due: string | null = null;
  if (v.billing_model === "recurring") {
    const fromForm = computeNextDueForNewRecurring(v);
    if (existing?.billing_model === "recurring") {
      const startChanged =
        (v.start_date || null) !== (existing.start_date?.slice(0, 10) ?? null);
      const unitChanged =
        interval_unit !== existing.interval_unit ||
        interval_count !== Math.max(1, existing.interval_count ?? 1);
      if (startChanged || unitChanged) {
        next_due = fromForm;
      } else {
        next_due = existing.next_due_date;
      }
    } else {
      next_due = fromForm;
    }
  } else {
    next_due = v.next_due_date.trim() || null;
  }

  return {
    title: v.title.trim(),
    notes: v.notes.trim() || null,
    website_url: v.website_url.trim() || null,
    category_id: v.category_id ? parseInt(v.category_id, 10) : null,
    billing_model: v.billing_model,
    interval_unit,
    interval_months: null,
    interval_count,
    auto_renew: v.auto_renew ? 1 : 0,
    amount_original: amt,
    currency_code: v.currency_code.trim().toUpperCase(),
    amount_qar_snapshot: primaryAmount,
    fx_rate_used: fxFactor,
    fx_quote_at: fxAt,
    start_date: v.start_date.trim() || null,
    next_due_date: next_due,
    end_date: v.end_date.trim() || null,
    is_domain: 0,
    account_label: v.account_label.trim() || null,
    credit_card_id: v.wallet_method_id
    ? null
    : v.credit_card_id
      ? parseInt(v.credit_card_id, 10)
      : null,
    wallet_method_id: v.wallet_method_id ? parseInt(v.wallet_method_id, 10) : null,
  };
}
