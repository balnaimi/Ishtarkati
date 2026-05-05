/** After onboarding sets a PIN, skip one lock prompt in the same browser session. */
const SKIP_NEXT_PIN_LOCK_KEY = "ishtarkati_skip_next_pin";

export function markSkipNextPinLock(): void {
  try {
    sessionStorage.setItem(SKIP_NEXT_PIN_LOCK_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** Returns true once if a skip was scheduled; clears the flag. */
export function consumeSkipNextPinLock(): boolean {
  try {
    if (sessionStorage.getItem(SKIP_NEXT_PIN_LOCK_KEY) !== "1") return false;
    sessionStorage.removeItem(SKIP_NEXT_PIN_LOCK_KEY);
    return true;
  } catch {
    return false;
  }
}
