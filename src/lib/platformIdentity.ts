/** Where the user registers / signs in: website, app, or both. */
export type PlatformType = "website" | "app" | "both";

export type RecoveryContactKind = "email" | "phone";

export function normalizePlatformType(raw: unknown): PlatformType {
  const v = String(raw ?? "website").trim();
  if (v === "app" || v === "both") return v;
  return "website";
}

export function platformTypeI18nKey(p: PlatformType): string {
  if (p === "app") return "platform.app";
  if (p === "both") return "platform.both";
  return "platform.website";
}

export function normalizeRecoveryKind(raw: unknown): RecoveryContactKind | null {
  const v = String(raw ?? "").trim();
  if (v === "email" || v === "phone") return v;
  return null;
}

export function recoveryKindI18nKey(k: RecoveryContactKind): string {
  return k === "phone" ? "form.recoveryPhone" : "form.recoveryEmail";
}

/** Website URL field is hidden for app-only accounts. */
export function showWebsiteField(platform: PlatformType): boolean {
  return platform !== "app";
}
