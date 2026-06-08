import type { BillingModel } from "../types";

export function isFreeAccount(sub: { billing_model: string }): boolean {
  return sub.billing_model === "free_account";
}

export function isPaidSubscription(sub: { billing_model: string }): boolean {
  return sub.billing_model === "one_time" || sub.billing_model === "recurring";
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
