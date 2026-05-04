/** Comma-separated subscription tags (normalized on save in formMappers). */
export function tagTokens(tags: string | null | undefined): string[] {
  if (!tags?.trim()) return [];
  return tags.split(",").map((s) => s.trim()).filter(Boolean);
}
