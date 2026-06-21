const DISMISS_KEY = "ishtarkati_update_dismiss";

/** Background retry delays after a failed check (ms), then capped at the last value. */
export const UPDATE_RETRY_DELAYS_MS = [30_000, 60_000, 2 * 60_000, 5 * 60_000] as const;

/** Regular poll interval when checks succeed or after backoff is exhausted. */
export const UPDATE_POLL_MS = 5 * 60 * 1000;

export type UpdateCheckStatus = "idle" | "checking" | "current" | "available" | "error";

export interface UpdateCheckState {
  status: UpdateCheckStatus;
  latest?: string;
  downloadUrl?: string;
  releaseUrl?: string;
  notes?: string;
  notesLocale?: string;
  error?: string;
}

export async function fetchLocalizedReleaseNotes(
  version: string,
  locale: string,
  fallbackEn: string,
): Promise<{ text: string; locale: string }> {
  if (locale.startsWith("ar")) {
    try {
      const url = `https://raw.githubusercontent.com/balnaimi/Ishtarkati/main/release-notes/v${version}.ar.md`;
      const res = await fetch(url, { headers: { "User-Agent": "Ishtarkati" } });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text) return { text, locale: "ar" };
      }
    } catch {
      /* fall through */
    }
  }
  return { text: fallbackEn, locale: "en" };
}

export function isUpdateDismissed(version: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === version;
  } catch {
    return false;
  }
}

export function dismissUpdate(version: string): void {
  try {
    localStorage.setItem(DISMISS_KEY, version);
  } catch {
    /* ignore */
  }
}

/** Strip leading title line; keep markdown sections readable in plain UI. */
export function formatReleaseNotesBody(raw: string): string[] {
  const lines = raw.split("\n").map((line) => line.trimEnd());
  const withoutTitle = lines[0]?.startsWith("# ") ? lines.slice(1) : lines;
  return withoutTitle.map((line) => line.trim()).filter((line) => line.length > 0);
}
