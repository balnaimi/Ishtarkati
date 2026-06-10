import type { BillingModel } from "../types";

/** Active account with no payment tracking (subscription ended or never paid). */
export function isFreeAccount(sub: { billing_model: string }): boolean {
  return sub.billing_model === "free_account";
}

export function isPaidSubscription(sub: { billing_model: string }): boolean {
  return sub.billing_model === "one_time" || sub.billing_model === "recurring";
}

export function isActiveAccount(sub: { cancelled_at?: string | null }): boolean {
  return !sub.cancelled_at?.trim();
}

export type AccountPaymentStatus = "free" | "recurring" | "one_time";

export function accountPaymentStatus(sub: { billing_model: string }): AccountPaymentStatus {
  if (sub.billing_model === "one_time") return "one_time";
  if (sub.billing_model === "recurring") return "recurring";
  return "free";
}

export function accountPaymentStatusI18nKey(status: AccountPaymentStatus): string {
  if (status === "free") return "accounts.statusFree";
  if (status === "one_time") return "accounts.statusOneTime";
  return "accounts.statusRecurring";
}

export function billingModelI18nKey(model: string): string {
  if (model === "free_account") return "billing.free_account";
  if (model === "one_time") return "billing.one_time";
  return "billing.recurring";
}

export type RecordKindFilter = "all" | "paid" | "free";

export function recordKindMatches(model: BillingModel | string, kind: RecordKindFilter): boolean {
  if (kind === "all") return true;
  if (kind === "free") return model === "free_account";
  return model === "one_time" || model === "recurring";
}

/** Client-side filter for online accounts page tabs. */
export type AccountPageFilter = "all" | "free" | "paid";

export function accountPageFilterMatches(
  sub: { billing_model: string },
  filter: AccountPageFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "free") return isFreeAccount(sub);
  return isPaidSubscription(sub);
}
