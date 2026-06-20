import { hostnameFromWebsiteUrl } from "./siteFavicon";

export type AccountSearchRow = {
  title: string;
  notes: string | null;
  website_url: string | null;
  account_label: string | null;
  login_username?: string | null;
  login_phone?: string | null;
  recovery_contact?: string | null;
  category_name?: string | null;
  tags?: string | null;
};

/** Lowercase haystack for substring search (title, URL, host, email, username, phone, notes, category, tags). */
export function accountSearchHaystack(row: AccountSearchRow): string {
  const host = hostnameFromWebsiteUrl(row.website_url) ?? "";
  return [
    row.title,
    row.notes,
    row.account_label,
    row.login_username,
    row.login_phone,
    row.recovery_contact,
    row.website_url,
    row.category_name,
    row.tags,
    host,
  ]
    .map((x) => (x ?? "").trim())
    .filter((x) => x.length > 0)
    .join(" ")
    .toLowerCase();
}

export function matchesAccountSearch(row: AccountSearchRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return accountSearchHaystack(row).includes(q);
}

export function filterFreeAccounts<T extends AccountSearchRow>(
  rows: T[],
  opts: { search?: string; email?: string },
): T[] {
  let out = rows;
  const email = opts.email?.trim().toLowerCase();
  if (email) {
    out = out.filter((s) => (s.account_label ?? "").trim().toLowerCase() === email);
  }
  const q = opts.search?.trim();
  if (q) {
    out = out.filter((s) => matchesAccountSearch(s, q));
  }
  return out;
}
