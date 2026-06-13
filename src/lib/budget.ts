export interface BudgetStatus {
  enabled: boolean;
  limit: number;
  spent: number;
  remaining: number;
  pct: number;
  over: boolean;
}

export function parseBudgetLimit(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function computeBudgetStatus(monthlyTotal: number, limitRaw: string | null | undefined): BudgetStatus {
  const limit = parseBudgetLimit(limitRaw);
  if (limit == null) {
    return {
      enabled: false,
      limit: 0,
      spent: monthlyTotal,
      remaining: 0,
      pct: 0,
      over: false,
    };
  }
  const spent = Math.max(0, monthlyTotal);
  const remaining = Math.max(0, limit - spent);
  const pct = limit > 0 ? Math.min(150, (spent / limit) * 100) : 0;
  return {
    enabled: true,
    limit,
    spent,
    remaining,
    pct,
    over: spent > limit,
  };
}
