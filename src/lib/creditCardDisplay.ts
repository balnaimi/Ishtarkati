import type { CreditCard } from "../types";
import { cardExpiryProgress } from "./dueProgress";

/** Line shown in lists: brand, last4, optional user description (e.g. card name or perks). */
export function creditCardPrimaryLine(card: CreditCard, brandLabel: string): string {
  const base = `${brandLabel} ·••• ${card.last4}`;
  const note = (card.description ?? "").trim();
  return note ? `${base} — ${note}` : base;
}

export type CreditCardsSummary = {
  count: number;
  nearestExpiry: {
    brand: string;
    last4: string;
    month: number;
    year: number;
    monthsLeft: number;
  } | null;
  expiringSoonCount: number;
  expiredCount: number;
};

export function summarizeCreditCards(cards: CreditCard[], now = new Date()): CreditCardsSummary {
  if (cards.length === 0) {
    return { count: 0, nearestExpiry: null, expiringSoonCount: 0, expiredCount: 0 };
  }

  let expiredCount = 0;
  let expiringSoonCount = 0;
  let nearest: CreditCardsSummary["nearestExpiry"] = null;

  for (const card of cards) {
    const xp = cardExpiryProgress(card.exp_month, card.exp_year, now);
    if (xp.monthsLeft < 0) {
      expiredCount += 1;
      continue;
    }
    if (xp.urgent) expiringSoonCount += 1;
    if (!nearest || xp.monthsLeft < nearest.monthsLeft) {
      nearest = {
        brand: card.brand,
        last4: card.last4,
        month: card.exp_month,
        year: card.exp_year,
        monthsLeft: xp.monthsLeft,
      };
    }
  }

  return {
    count: cards.length,
    nearestExpiry: nearest,
    expiringSoonCount,
    expiredCount,
  };
}
