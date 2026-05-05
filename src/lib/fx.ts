/** FX helpers: fetch USD-based rates and convert amounts to QAR. */

export type UsdBasedRates = Record<string, number>;

/**
 * Rough USD-peg snapshot (rates are “foreign currency per 1 USD” like exchangerate.host).
 * Used offline and merged under any cached/live rates so saves work without internet.
 */
export const BUILTIN_FX_RATES: UsdBasedRates = {
  USD: 1,
  QAR: 3.64,
  EUR: 0.92,
  GBP: 0.79,
  SAR: 3.75,
  AED: 3.67,
  KWD: 0.31,
  BHD: 0.38,
  OMR: 0.38,
  JOD: 0.71,
  EGP: 50.5,
  INR: 83,
  TRY: 32,
  CHF: 0.88,
  CAD: 1.36,
  AUD: 1.52,
  NZD: 1.68,
  JPY: 149,
  CNY: 7.24,
  IQD: 1310,
};

export function mergeUsdRates(liveOrCache: UsdBasedRates | null | undefined): UsdBasedRates {
  return { ...BUILTIN_FX_RATES, ...(liveOrCache ?? {}) };
}

/** Merge a stored cache JSON string with built-ins (for stats / tools). */
export function mergeRatesFromCacheJson(cacheRaw: string | null): UsdBasedRates {
  if (!cacheRaw) return { ...BUILTIN_FX_RATES };
  try {
    const parsed = JSON.parse(cacheRaw) as { rates?: UsdBasedRates };
    return mergeUsdRates(parsed.rates ?? null);
  } catch {
    return { ...BUILTIN_FX_RATES };
  }
}

const FX_ENDPOINT = "https://api.exchangerate.host/latest?base=USD";

export interface FxFetchResult {
  rates: UsdBasedRates;
  fetchedAt: string;
}

/**
 * Rates use API convention: value is "currency per 1 USD".
 * QAR per unit of CUR = rates.QAR / rates.CUR (CUR per USD in denominator).
 */
export function amountToQarFromUsdBase(
  amount: number,
  currencyCode: string,
  rates: UsdBasedRates,
  overrides: Record<string, number> | null,
): { qar: number; fxFactor: number } {
  const c = currencyCode.trim().toUpperCase();
  if (c === "QAR") {
    return { qar: amount, fxFactor: 1 };
  }
  if (overrides && overrides[c] != null) {
    const mult = overrides[c]!;
    return { qar: amount * mult, fxFactor: mult };
  }
  const qarPerUsd = rates["QAR"];
  const curPerUsd = rates[c];
  if (qarPerUsd == null || curPerUsd == null || curPerUsd === 0) {
    throw new Error(`Missing FX rate for ${c}`);
  }
  const qarPerUnit = qarPerUsd / curPerUsd;
  return { qar: amount * qarPerUnit, fxFactor: qarPerUnit };
}

/**
 * Convert amount from `currencyCode` to user's primary display currency.
 * Same convention as amountToQarFromUsdBase: rates are "currency per 1 USD".
 */
export function amountToPrimaryFromUsdBase(
  amount: number,
  currencyCode: string,
  primaryCode: string,
  rates: UsdBasedRates,
  overrides: Record<string, number> | null,
): { primary: number; fxFactor: number } {
  const c = currencyCode.trim().toUpperCase();
  const p = primaryCode.trim().toUpperCase();
  if (c === p) {
    return { primary: amount, fxFactor: 1 };
  }
  if (overrides && overrides[c] != null) {
    const mult = overrides[c]!;
    return { primary: amount * mult, fxFactor: mult };
  }
  const primaryPerUsd = rates[p];
  const curPerUsd = rates[c];
  if (primaryPerUsd == null || curPerUsd == null || curPerUsd === 0) {
    throw new Error(`Missing FX rate for ${c}`);
  }
  const primaryPerUnit = primaryPerUsd / curPerUsd;
  return { primary: amount * primaryPerUnit, fxFactor: primaryPerUnit };
}

export async function fetchFxRates(): Promise<FxFetchResult> {
  const res = await fetch(FX_ENDPOINT);
  if (!res.ok) {
    throw new Error(`FX HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    success?: boolean;
    rates?: Record<string, number>;
  };
  if (!body.rates || typeof body.rates !== "object") {
    throw new Error("FX response invalid");
  }
  if (body.success === false) {
    throw new Error("FX response invalid");
  }
  const rates = mergeUsdRates({ ...body.rates, USD: 1 });
  return {
    rates,
    fetchedAt: new Date().toISOString(),
  };
}
