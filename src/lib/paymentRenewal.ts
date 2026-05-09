import type { PaymentEvent } from "../types";

/** Steps covered by this payment (each step = one subscription billing step / `interval_unit`). */
export function effectiveRenewalSteps(p: PaymentEvent): number | null {
  const raw = p.renewal_step_count ?? p.renewal_years;
  if (raw == null || !Number.isFinite(raw)) return null;
  const n = Math.floor(Number(raw));
  return n > 0 ? n : null;
}
