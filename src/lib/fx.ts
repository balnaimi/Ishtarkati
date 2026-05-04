/** FX helpers: fetch USD-based rates and convert amounts to QAR. */

export type UsdBasedRates = Record<string, number>;

const FX_ENDPOINT =
  "https://api.exchangerate.host/latest?base=USD&symbols=QAR,EUR,GBP,SAR,AED,USD";

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

export async function fetchFxRates(): Promise<FxFetchResult> {
  const res = await fetch(FX_ENDPOINT);
  if (!res.ok) {
    throw new Error(`FX HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    success?: boolean;
    rates?: Record<string, number>;
  };
  if (body.success === false || !body.rates) {
    throw new Error("FX response invalid");
  }
  const rates: UsdBasedRates = { ...body.rates, USD: 1 };
  if (rates.QAR == null) {
    throw new Error("FX missing QAR");
  }
  return {
    rates,
    fetchedAt: new Date().toISOString(),
  };
}
