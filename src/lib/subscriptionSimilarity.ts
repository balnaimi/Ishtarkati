/** Duplicate / similar subscription detection — shared logic with backup import. */

export function hostnameNorm(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeTitle(t: unknown): string {
  if (t == null) return "";
  return String(t)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function subscriptionSimilarityKey(
  title: unknown,
  websiteUrl: unknown,
  accountLabel?: unknown,
  loginUsername?: unknown,
): string {
  const acc =
    accountLabel == null || String(accountLabel).trim() === ""
      ? ""
      : String(accountLabel).trim().toLowerCase();
  const user =
    loginUsername == null || String(loginUsername).trim() === ""
      ? ""
      : String(loginUsername).trim().toLowerCase();
  const host = hostnameNorm(websiteUrl == null ? undefined : String(websiteUrl));
  const tit = normalizeTitle(title);
  if (host && tit) return `${tit}|${host}|${acc}|${user}`;
  if (host) return `|${host}|${acc}|${user}`;
  return `${tit}||${acc}|${user}`;
}

export interface SimilarityFields {
  title: string;
  website_url: string | null;
  account_label?: string | null;
  login_username?: string | null;
  id?: number;
}

export function areSubscriptionsSimilar(a: SimilarityFields, b: SimilarityFields): boolean {
  if (a.id != null && b.id != null && a.id === b.id) return false;
  const ka = subscriptionSimilarityKey(a.title, a.website_url, a.account_label, a.login_username);
  const kb = subscriptionSimilarityKey(b.title, b.website_url, b.account_label, b.login_username);
  if (!ka || !kb) return false;
  return ka === kb;
}

export function findSimilarInList<T extends SimilarityFields>(
  candidates: T[],
  probe: SimilarityFields,
  excludeId?: number,
): T[] {
  const pid = excludeId ?? probe.id;
  return candidates.filter((c) => {
    if (pid != null && c.id === pid) return false;
    return areSubscriptionsSimilar(probe, c);
  });
}
