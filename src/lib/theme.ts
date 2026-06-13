import { getSetting, setSetting } from "../db/repo";
import { THEME_MODE_KEY } from "./settingsKeys";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "ishtarkati_theme";

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return systemPrefersDark();
}

export function applyThemeMode(mode: ThemeMode): void {
  const dark = resolveDark(mode);
  document.documentElement.classList.toggle("dark", dark);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }
}

export function parseThemeMode(raw: string | null | undefined): ThemeMode {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

/** Load theme from DB (fallback: localStorage legacy, then system). */
export async function loadAndApplyTheme(): Promise<ThemeMode> {
  const fromDb = await getSetting(THEME_MODE_KEY);
  let mode = parseThemeMode(fromDb);
  if (!fromDb && typeof localStorage !== "undefined") {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy === "dark") mode = "dark";
    else if (legacy === "light") mode = "light";
  }
  applyThemeMode(mode);
  return mode;
}

export async function persistThemeMode(mode: ThemeMode): Promise<void> {
  await setSetting(THEME_MODE_KEY, mode);
  applyThemeMode(mode);
}

/** Listen for OS theme changes when mode is system. */
export function watchSystemTheme(onChange: (dark: boolean) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange(mq.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
