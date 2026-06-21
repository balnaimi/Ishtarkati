/** Store-friendly URL — prepends https:// when the user omitted a scheme. */
export function normalizeWebsiteUrlForStorage(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/** Form input — show host/path without protocol for easier editing. */
export function websiteUrlForFormInput(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return "";
  return t.replace(/^https?:\/\//i, "");
}

/** Clickable href — always includes a scheme. */
export function websiteUrlForHref(raw: string | null | undefined): string | null {
  return normalizeWebsiteUrlForStorage(raw);
}

/** Extract hostname from a user-entered URL (adds https if missing). */
export function hostnameFromWebsiteUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  let u = t;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    const h = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return h.length > 0 ? h : null;
  } catch {
    return null;
  }
}

/** Ordered list of favicon URLs to try (first good load wins in the UI). */
export function faviconCandidateUrls(hostname: string): string[] {
  const h = hostname.trim();
  if (!h) return [];
  return [
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(h)}.ico`,
    `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(h)}`,
    `https://${h}/favicon.ico`,
  ];
}

/** Short label for links (host + path prefix, no protocol). */
export function displayUrlForUi(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return "";
  let u = t;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    const path = url.pathname && url.pathname !== "/" ? url.pathname.replace(/\/$/, "") : "";
    const q = url.search || "";
    const slice = path.length > 48 ? `${path.slice(0, 46)}…` : path;
    return `${url.hostname}${slice}${q}` || url.hostname;
  } catch {
    return t;
  }
}
