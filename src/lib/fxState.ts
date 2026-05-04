import type { UsdBasedRates } from "./fx";

/** FX snapshot for forms and stats (loaded from settings + network). */
export interface FxState {
  usdRates: UsdBasedRates | null;
  fetchedAt: string | null;
  overrides: Record<string, number> | null;
}
