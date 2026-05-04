import { getDb } from "./database";
import { intervalToMonths } from "../lib/schedule";
import type {
  BillingModel,
  Category,
  IntervalUnit,
  PaymentEvent,
  Subscription,
} from "../types";

export async function loadCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category>(
    "SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, id ASC",
  );
}

export async function addCategory(name: string, sort_order: number): Promise<number> {
  const db = await getDb();
  const r = await db.execute(
    "INSERT INTO categories (name, sort_order) VALUES ($1, $2)",
    [name.trim(), sort_order],
  );
  if (r.lastInsertId != null && r.lastInsertId > 0) return r.lastInsertId;
  const idRows = await db.select<{ id: number }>(
    "SELECT last_insert_rowid() AS id",
  );
  return idRows[0]?.id ?? 0;
}

export async function updateCategory(
  id: number,
  name: string,
  sort_order: number,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE categories SET name = $1, sort_order = $2 WHERE id = $3",
    [name.trim(), sort_order, id],
  );
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE subscriptions SET category_id = NULL WHERE category_id = $1", [
    id,
  ]);
  await db.execute("DELETE FROM categories WHERE id = $1", [id]);
}

export interface AppCurrency {
  code: string;
  sort_order: number;
}

export async function loadCurrencies(): Promise<AppCurrency[]> {
  const db = await getDb();
  return db.select<AppCurrency>(
    "SELECT UPPER(TRIM(code)) AS code, sort_order FROM currencies ORDER BY sort_order ASC, code ASC",
  );
}

export async function addCurrency(code: string, sort_order: number): Promise<void> {
  const db = await getDb();
  const c = code.trim().toUpperCase();
  if (c.length < 2 || c.length > 8) {
    throw new Error("invalid_currency_code");
  }
  await db.execute(
    "INSERT INTO currencies (code, sort_order) VALUES ($1, $2)",
    [c, sort_order],
  );
}

export async function updateCurrencySort(code: string, sort_order: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE currencies SET sort_order = $1 WHERE UPPER(code) = UPPER($2)",
    [sort_order, code.trim()],
  );
}

export async function deleteCurrency(code: string): Promise<void> {
  const db = await getDb();
  const c = code.trim();
  const rows = await db.select<{ n: number }>(
    "SELECT COUNT(*) AS n FROM subscriptions WHERE UPPER(currency_code) = UPPER($1)",
    [c],
  );
  if ((rows[0]?.n ?? 0) > 0) {
    throw new Error("currency_in_use");
  }
  await db.execute("DELETE FROM currencies WHERE UPPER(code) = UPPER($1)", [c]);
}

export interface SubscriptionListRow extends Subscription {
  category_name: string | null;
}

function buildSubscriptionQuery(filters: {
  categoryId?: number;
  currency?: string;
  dueWithinDays?: number;
  search?: string;
}): { sql: string; args: unknown[] } {
  const clauses: string[] = ["1=1"];
  const args: unknown[] = [];
  let i = 0;
  const next = (v: unknown) => {
    args.push(v);
    i += 1;
    return `$${i}`;
  };

  if (filters.categoryId != null) {
    clauses.push(`s.category_id = ${next(filters.categoryId)}`);
  }
  if (filters.currency) {
    clauses.push(`s.currency_code = ${next(filters.currency.toUpperCase())}`);
  }
  if (filters.dueWithinDays != null && filters.dueWithinDays > 0) {
    const limit = new Date();
    limit.setDate(limit.getDate() + filters.dueWithinDays);
    const lim = limit.toISOString().slice(0, 10);
    clauses.push(
      `s.next_due_date IS NOT NULL AND s.next_due_date <= ${next(lim)}`,
    );
  }
  if (filters.search?.trim()) {
    const pat = `%${filters.search.trim()}%`;
    const p1 = next(pat);
    clauses.push(`(s.title LIKE ${p1} OR IFNULL(s.notes,'') LIKE ${p1})`);
  }

  const sql = `
    SELECT s.*, c.name AS category_name
    FROM subscriptions s
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY s.next_due_date IS NULL, s.next_due_date ASC, s.title ASC
  `;
  return { sql, args };
}

export async function loadSubscriptions(filters: {
  categoryId?: number;
  currency?: string;
  dueWithinDays?: number;
  search?: string;
}): Promise<SubscriptionListRow[]> {
  const db = await getDb();
  const { sql, args } = buildSubscriptionQuery(filters);
  return db.select<SubscriptionListRow>(sql, args);
}

export async function getSubscription(id: number): Promise<SubscriptionListRow | null> {
  const db = await getDb();
  const rows = await db.select<SubscriptionListRow>(
    `SELECT s.*, c.name AS category_name
     FROM subscriptions s
     LEFT JOIN categories c ON c.id = s.category_id
     WHERE s.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function insertSubscription(row: {
  title: string;
  notes: string | null;
  website_url: string | null;
  category_id: number | null;
  billing_model: BillingModel;
  interval_unit: IntervalUnit | null;
  interval_months: number | null;
  auto_renew: number;
  amount_original: number;
  currency_code: string;
  amount_qar_snapshot: number | null;
  fx_rate_used: number | null;
  fx_quote_at: string | null;
  start_date: string | null;
  next_due_date: string | null;
  end_date: string | null;
  is_domain: number;
}): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const r = await db.execute(
    `INSERT INTO subscriptions (
      title, notes, website_url, category_id, billing_model, interval_unit, interval_months,
      auto_renew, amount_original, currency_code, amount_qar_snapshot, fx_rate_used, fx_quote_at,
      start_date, next_due_date, end_date, is_domain, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    )`,
    [
      row.title,
      row.notes,
      row.website_url,
      row.category_id,
      row.billing_model,
      row.interval_unit,
      row.interval_months,
      row.auto_renew,
      row.amount_original,
      row.currency_code,
      row.amount_qar_snapshot,
      row.fx_rate_used,
      row.fx_quote_at,
      row.start_date,
      row.next_due_date,
      row.end_date,
      row.is_domain,
      now,
      now,
    ],
  );
  if (r.lastInsertId != null && r.lastInsertId > 0) {
    return r.lastInsertId;
  }
  const idRows = await db.select<{ id: number }>(
    "SELECT last_insert_rowid() AS id",
  );
  return idRows[0]?.id ?? 0;
}

export async function updateSubscription(
  id: number,
  row: {
    title: string;
    notes: string | null;
    website_url: string | null;
    category_id: number | null;
    billing_model: BillingModel;
    interval_unit: IntervalUnit | null;
    interval_months: number | null;
    auto_renew: number;
    amount_original: number;
    currency_code: string;
    amount_qar_snapshot: number | null;
    fx_rate_used: number | null;
    fx_quote_at: string | null;
    start_date: string | null;
    next_due_date: string | null;
    end_date: string | null;
    is_domain: number;
  },
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE subscriptions SET
      title = $1, notes = $2, website_url = $3, category_id = $4,
      billing_model = $5, interval_unit = $6, interval_months = $7, auto_renew = $8,
      amount_original = $9, currency_code = $10, amount_qar_snapshot = $11,
      fx_rate_used = $12, fx_quote_at = $13, start_date = $14, next_due_date = $15,
      end_date = $16, is_domain = $17, updated_at = $18
    WHERE id = $19`,
    [
      row.title,
      row.notes,
      row.website_url,
      row.category_id,
      row.billing_model,
      row.interval_unit,
      row.interval_months,
      row.auto_renew,
      row.amount_original,
      row.currency_code,
      row.amount_qar_snapshot,
      row.fx_rate_used,
      row.fx_quote_at,
      row.start_date,
      row.next_due_date,
      row.end_date,
      row.is_domain,
      now,
      id,
    ],
  );
}

export async function deleteSubscription(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM subscriptions WHERE id = $1", [id]);
}

export async function updateSubscriptionQarSnapshot(
  id: number,
  qar: number,
  fxFactor: number,
  fxAt: string,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE subscriptions SET amount_qar_snapshot = $1, fx_rate_used = $2, fx_quote_at = $3, updated_at = $4 WHERE id = $5`,
    [qar, fxFactor, fxAt, now, id],
  );
}

export async function setSubscriptionNextDue(
  id: number,
  nextIsoDate: string | null,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    "UPDATE subscriptions SET next_due_date = $1, updated_at = $2 WHERE id = $3",
    [nextIsoDate, now, id],
  );
}

export async function listPayments(subId: number): Promise<PaymentEvent[]> {
  const db = await getDb();
  return db.select<PaymentEvent>(
    "SELECT * FROM payment_events WHERE subscription_id = $1 ORDER BY paid_at DESC, id DESC",
    [subId],
  );
}

export async function insertPaymentEvent(
  subId: number,
  paidAt: string,
  amountOriginal: number | null,
  currency: string | null,
  amountQar: number | null,
  renewalYears: number | null,
  note: string | null,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO payment_events (subscription_id, paid_at, amount_original, currency, amount_qar, renewal_years, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [subId, paidAt, amountOriginal, currency, amountQar, renewalYears, note],
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }>(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}

/** Monthly-equivalent QAR for recurring rows (rough estimate). */
export function monthlyEquivalentQar(s: Subscription): number | null {
  if (s.billing_model !== "recurring" || s.amount_qar_snapshot == null) {
    return null;
  }
  const months = intervalToMonths(
    s.interval_unit as IntervalUnit | null,
    s.interval_months,
  );
  if (months <= 0) return null;
  return s.amount_qar_snapshot / months;
}

export async function statsSummary(): Promise<{
  monthlyEstimate: number;
  byCategory: { name: string; monthlyQar: number }[];
  due30Total: number;
  recurringCount: number;
}> {
  const rows = await loadSubscriptions({});
  let monthlyEstimate = 0;
  let due30Total = 0;
  let recurringCount = 0;
  const limit = new Date();
  limit.setDate(limit.getDate() + 30);
  const lim = limit.toISOString().slice(0, 10);

  const catMap = new Map<string, number>();

  for (const s of rows) {
    if (s.billing_model === "recurring" && s.amount_qar_snapshot != null) {
      recurringCount++;
      const m = monthlyEquivalentQar(s);
      if (m != null) {
        monthlyEstimate += m;
        const cname = s.category_name ?? "—";
        catMap.set(cname, (catMap.get(cname) ?? 0) + m);
      }
    }
    if (
      s.next_due_date &&
      s.next_due_date <= lim &&
      s.amount_qar_snapshot != null
    ) {
      due30Total += s.amount_qar_snapshot;
    }
  }

  const byCategory = [...catMap.entries()]
    .map(([name, monthlyQar]) => ({ name, monthlyQar }))
    .sort((a, b) => b.monthlyQar - a.monthlyQar);

  return { monthlyEstimate, byCategory, due30Total, recurringCount };
}
