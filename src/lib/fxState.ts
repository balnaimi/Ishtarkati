import type { UsdBasedRates } from "./fx";

/** FX snapshot for forms and stats (built-in + cache + overrides). */
export interface FxState {
  usdRates: UsdBasedRates;
  fetchedAt: string | null;
  overrides: Record<string, number> | null;
  /** A saved network snapshot exists in settings (not only built-ins). */
  hasLiveFxCache: boolean;
}
