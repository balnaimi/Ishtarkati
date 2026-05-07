import type { CreditCard } from "../types";

/** Line shown in lists: brand, last4, optional user description (e.g. card name or perks). */
export function creditCardPrimaryLine(card: CreditCard, brandLabel: string): string {
  const base = `${brandLabel} ·••• ${card.last4}`;
  const note = (card.description ?? "").trim();
  return note ? `${base} — ${note}` : base;
}
