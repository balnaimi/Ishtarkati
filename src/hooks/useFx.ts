import { useCallback, useState } from "react";
import { fetchFxRates, type UsdBasedRates } from "../lib/fx";
import { getSetting, setSetting } from "../db/repo";
import type { FxState } from "../lib/fxState";

const CACHE_KEY = "fx_rates_cache";
const OVERRIDES_KEY = "fx_overrides_json";

export function useFxManager() {
  const [fx, setFx] = useState<FxState>({
    usdRates: null,
    fetchedAt: null,
    overrides: null,
  });

  const hydrate = useCallback(async () => {
    const cacheRaw = await getSetting(CACHE_KEY);
    const ovrRaw = await getSetting(OVERRIDES_KEY);
    let usdRates: UsdBasedRates | null = null;
    let fetchedAt: string | null = null;
    if (cacheRaw) {
      try {
        const parsed = JSON.parse(cacheRaw) as { rates: UsdBasedRates; fetchedAt: string };
        usdRates = parsed.rates;
        fetchedAt = parsed.fetchedAt;
      } catch {
        /* ignore */
      }
    }
    let overrides: Record<string, number> | null = null;
    if (ovrRaw) {
      try {
        overrides = JSON.parse(ovrRaw) as Record<string, number>;
      } catch {
        overrides = null;
      }
    }
    setFx({ usdRates, fetchedAt, overrides });
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
    await setSetting(
      CACHE_KEY,
      JSON.stringify({ rates: data.rates, fetchedAt: data.fetchedAt }),
    );
    setFx({
      usdRates: data.rates,
      fetchedAt: data.fetchedAt,
      overrides,
    });
  }, []);

  return { fx, hydrate, refresh };
}
