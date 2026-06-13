/**
 * Validates commit messages are English-only (no Arabic script).
 */
const ARABIC_RE = /[\u0600-\u06FF]/;

export function hasArabicScript(text) {
  return ARABIC_RE.test(text);
}

export function assertEnglishCommitMessage(message) {
  const trimmed = String(message ?? "").trim();
  if (!trimmed) return;
  if (hasArabicScript(trimmed)) {
    throw new Error(
      "Commit message must be English only (Arabic script detected). Use CHANGELOG.md for user-facing notes.",
    );
  }
}
