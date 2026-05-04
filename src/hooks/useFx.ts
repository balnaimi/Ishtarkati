import { useCallback, useState } from "react";
import {
  fetchFxRates,
  mergeUsdRates,
  BUILTIN_FX_RATES,
  type UsdBasedRates,
} from "../lib/fx";
import { getSetting, setSetting } from "../db/repo";
import type { FxState } from "../lib/fxState";

const CACHE_KEY = "fx_rates_cache";
const OVERRIDES_KEY = "fx_overrides_json";

export function useFxManager() {
  const [fx, setFx] = useState<FxState>({
    usdRates: { ...BUILTIN_FX_RATES },
    fetchedAt: null,
    overrides: null,
    hasLiveFxCache: false,
  });

  const hydrate = useCallback(async () => {
    const cacheRaw = await getSetting(CACHE_KEY);
    const ovrRaw = await getSetting(OVERRIDES_KEY);
    let overrides: Record<string, number> | null = null;
    if (ovrRaw) {
      try {
        overrides = JSON.parse(ovrRaw) as Record<string, number>;
      } catch {
        overrides = null;
      }
    }
    let usdRates: UsdBasedRates = { ...BUILTIN_FX_RATES };
    let fetchedAt: string | null = null;
    let hasLiveFxCache = false;
    if (cacheRaw) {
      try {
        const parsed = JSON.parse(cacheRaw) as { rates: UsdBasedRates; fetchedAt: string };
        usdRates = mergeUsdRates(parsed.rates);
        fetchedAt = parsed.fetchedAt;
        hasLiveFxCache = true;
      } catch {
        /* keep built-ins only */
      }
    }
    setFx({ usdRates, fetchedAt, overrides, hasLiveFxCache });
  }, []);

  const refresh = useCallback(async () => {
    const data = await fetchFxRates();
    const ovrRaw = await getSetting(OVERRIDES_KEY);
    let overrides: Record<string, number> | null = null;
    if (ovrRaw) {
      try {
        overrides = JSON.parse(ovrRaw) as Record<string, number>;
      } catch {
        overrides = null;
      }
    }
    const merged = mergeUsdRates(data.rates);
    await setSetting(
      CACHE_KEY,
      JSON.stringify({ rates: merged, fetchedAt: data.fetchedAt }),
    );
    setFx({
      usdRates: merged,
      fetchedAt: data.fetchedAt,
      overrides,
      hasLiveFxCache: true,
    });
  }, []);

  return { fx, hydrate, refresh };
}
