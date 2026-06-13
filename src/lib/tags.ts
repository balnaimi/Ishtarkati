/** Parse comma-separated subscription tags (trimmed, no empties). */
export function parseTags(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw).split(",")) {
    const t = part.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Canonical storage: comma-separated, no spaces around commas. */
export function joinTags(tags: string[]): string | null {
  const normalized = parseTags(tags.join(","));
  return normalized.length > 0 ? normalized.join(",") : null;
}

export function removeTagFromString(raw: string | null | undefined, name: string): string | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return raw?.trim() || null;
  return joinTags(parseTags(raw).filter((t) => t.toLowerCase() !== needle));
}

export function renameTagInString(
  raw: string | null | undefined,
  oldName: string,
  newName: string,
): string | null {
  const oldKey = oldName.trim().toLowerCase();
  const newTrim = newName.trim();
  if (!oldKey || !newTrim) return raw?.trim() || null;
  const tags = parseTags(raw).map((t) => (t.toLowerCase() === oldKey ? newTrim : t));
  return joinTags(tags);
}
