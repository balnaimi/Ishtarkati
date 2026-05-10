/** Comma-separated subscription tags (normalized on save in formMappers). */
export function tagTokens(tags: string | null | undefined): string[] {
  if (!tags?.trim()) return [];
  return tags.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * For comma-separated tag entry: completed part (with trailing ", ") and the segment being edited.
 */
export function tagsLeadingAndToken(raw: string): { leading: string; token: string } {
  const idx = raw.lastIndexOf(",");
  if (idx === -1) {
    return { leading: "", token: raw.trimStart() };
  }
  return {
    leading: `${raw.slice(0, idx).trimEnd()}, `,
    token: raw.slice(idx + 1).trimStart(),
  };
}

/** Loose match for filtering tag suggestions (Latin + Arabic-friendly). */
export function tagMatchesQuery(tag: string, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("und");
  if (!q) return true;
  return tag.toLocaleLowerCase("und").includes(q);
}
