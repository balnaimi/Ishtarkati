import { getDb } from "./database";
import {
  addBillingSteps,
  formatDateInput,
  parseDateInput,
} from "../lib/schedule";
import {
  cashflowByCategoryInRange,
  countAndSumCashflowInRange,
  isoCalendarMonthBounds,
} from "../lib/cashflowProjection";
import type { BillingModel, Category, CreditCard, IntervalUnit, PaymentEvent, Subscription, WalletMethod } from "../types";

/** Machine note stored for quick «mark paid»; UI shows `detail.paymentNoteMarkPaid`. */
export const PAYMENT_NOTE_MARK_PAID = "__ishtarkati_mark_paid__";

export type CategoryWithActiveCount = Category & { activeSubscriptionCount: number };

export async function loadCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category>(
    "SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, id ASC",
  );
}

export async function addCategory(name: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM categories",
  );
  const nextOrder = (rows[0]?.m ?? -1) + 1;
  const r = await db.execute(
    "INSERT INTO categories (name, sort_order) VALUES ($1, $2)",
    [name.trim(), nextOrder],
  );
  if (r.lastInsertId != null && r.lastInsertId > 0) return r.lastInsertId;
  const idRows = await db.select<{ id: number }>(
    "SELECT last_insert_rowid() AS id",
  );
  return idRows[0]?.id ?? 0;
}

export async function updateCategory(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE categories SET name = $1 WHERE id = $2",
    [name.trim(), id],
  );
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE subscriptions SET category_id = NULL WHERE category_id = $1", [
    id,
  ]);
  await db.execute("DELETE FROM categories WHERE id = $1", [id]);
}

export async function loadCategoriesWithActiveCounts(): Promise<CategoryWithActiveCount[]> {
  const db = await getDb();
  return db.select<CategoryWithActiveCount>(
    `SELECT c.id, c.name, c.sort_order,
      (SELECT COUNT(*) FROM subscriptions s WHERE s.category_id = c.id AND s.cancelled_at IS NULL) AS activeSubscriptionCount
     FROM categories c
     ORDER BY c.sort_order ASC, c.id ASC`,
  );
}

export async function countActiveSubscriptionsUncategorized(): Promise<number> {
  const db = await getDb();
  const r = await db.select<{ n: number }>(
    "SELECT COUNT(*) AS n FROM subscriptions WHERE category_id IS NULL AND cancelled_at IS NULL",
  );
  return r[0]?.n ?? 0;
}

/** @deprecated Legacy table; UI uses built-in ISO list. */
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

export async function loadCreditCards(): Promise<CreditCard[]> {
  const db = await getDb();
  return db.select<CreditCard>(
    "SELECT id, brand, last4, exp_month, exp_year, description, created_at, updated_at FROM credit_cards ORDER BY exp_year ASC, exp_month ASC, id ASC",
  );
}

export async function insertCreditCard(row: {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  description: string | null;
}): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const desc = (row.description ?? "").trim() || null;
  const r = await db.execute(
    `INSERT INTO credit_cards (brand, last4, exp_month, exp_year, description, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [row.brand.trim(), row.last4.trim(), row.exp_month, row.exp_year, desc, now, now],
  );
  if (r.lastInsertId != null && r.lastInsertId > 0) return r.lastInsertId;
  const idRows = await db.select<{ id: number }>("SELECT last_insert_rowid() AS id");
  return idRows[0]?.id ?? 0;
}

export async function updateCreditCard(
  id: number,
  row: { brand: string; last4: string; exp_month: number; exp_year: number; description: string | null },
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const desc = (row.description ?? "").trim() || null;
  await db.execute(
    `UPDATE credit_cards SET brand = $1, last4 = $2, exp_month = $3, exp_year = $4, description = $5, updated_at = $6 WHERE id = $7`,
    [row.brand.trim(), row.last4.trim(), row.exp_month, row.exp_year, desc, now, id],
  );
}

export async function deleteCreditCard(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE wallet_methods SET linked_card_id = NULL WHERE linked_card_id = $1", [
    id,
  ]);
  await db.execute("UPDATE subscriptions SET credit_card_id = NULL WHERE credit_card_id = $1", [id]);
  await db.execute("DELETE FROM credit_cards WHERE id = $1", [id]);
}

export async function loadWalletMethods(): Promise<WalletMethod[]> {
  const db = await getDb();
  return db.select<WalletMethod>(
    "SELECT id, service_code, account_text, linked_card_id, created_at, updated_at FROM wallet_methods ORDER BY id ASC",
  );
}

export async function insertWalletMethod(row: {
  service_code: string;
  account_text: string;
  linked_card_id: number | null;
}): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const r = await db.execute(
    `INSERT INTO wallet_methods (service_code, account_text, linked_card_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [row.service_code.trim().toUpperCase(), row.account_text.trim(), row.linked_card_id, now, now],
  );
  if (r.lastInsertId != null && r.lastInsertId > 0) return r.lastInsertId;
  const idRows = await db.select<{ id: number }>("SELECT last_insert_rowid() AS id");
  return idRows[0]?.id ?? 0;
}

export async function updateWalletMethod(
  id: number,
  row: { service_code: string; account_text: string; linked_card_id: number | null },
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE wallet_methods SET service_code = $1, account_text = $2, linked_card_id = $3, updated_at = $4 WHERE id = $5`,
    [row.service_code.trim().toUpperCase(), row.account_text.trim(), row.linked_card_id, now, id],
  );
}

export async function deleteWalletMethod(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE subscriptions SET wallet_method_id = NULL WHERE wallet_method_id = $1", [
    id,
  ]);
  await db.execute("DELETE FROM wallet_methods WHERE id = $1", [id]);
}

export interface SubscriptionListRow extends Subscription {
  category_name: string | null;
}

function buildSubscriptionQuery(filters: {
  categoryId?: number;
  currency?: string;
  dueWithinDays?: number;
  search?: string;
  recordKind?: "all" | "paid" | "free";
  /** Default `active`: excludes cancelled rows (`cancelled_at` set). */
  subscriptionStatus?: "active" | "cancelled" | "all";
}): { sql: string; args: unknown[] } {
  const clauses: string[] = ["1=1"];
  const args: unknown[] = [];
  let i = 0;
  const next = (v: unknown) => {
    args.push(v);
    i += 1;
    return `$${i}`;
  };

  const status = filters.subscriptionStatus ?? "active";
  if (status === "active") {
    clauses.push("s.cancelled_at IS NULL");
  } else if (status === "cancelled") {
    clauses.push("s.cancelled_at IS NOT NULL");
  }

  if (filters.categoryId != null) {
    clauses.push(`s.category_id = ${next(filters.categoryId)}`);
  }
  if (filters.currency) {
    clauses.push(`s.currency_code = ${next(filters.currency.toUpperCase())}`);
  }
  if (filters.recordKind === "paid") {
    clauses.push("s.billing_model IN ('one_time', 'recurring')");
  } else if (filters.recordKind === "free") {
    clauses.push("s.billing_model = 'free_account'");
  }
  if (filters.dueWithinDays != null && filters.dueWithinDays > 0) {
    const limit = new Date();
    limit.setDate(limit.getDate() + filters.dueWithinDays);
    const lim = limit.toISOString().slice(0, 10);
    clauses.push(
      `s.billing_model != 'free_account' AND s.next_due_date IS NOT NULL AND s.next_due_date <= ${next(lim)}`,
    );
  }
  if (filters.search?.trim()) {
    const escaped = filters.search.trim().replace(/[%_\\]/g, (c) => `\\${c}`);
    const pat = `%${escaped}%`;
    const p1 = next(pat);
    clauses.push(
      `(s.title LIKE ${p1} ESCAPE '\\' OR IFNULL(s.notes,'') LIKE ${p1} ESCAPE '\\' OR IFNULL(s.account_label,'') LIKE ${p1} ESCAPE '\\' OR IFNULL(s.website_url,'') LIKE ${p1} ESCAPE '\\' OR IFNULL(c.name,'') LIKE ${p1} ESCAPE '\\')`,
    );
  }

  const orderBy =
    status === "cancelled"
      ? "ORDER BY s.cancelled_at DESC, s.updated_at DESC, s.title ASC"
      : filters.recordKind === "free"
        ? "ORDER BY s.title ASC, s.id ASC"
        : "ORDER BY s.next_due_date IS NULL, s.next_due_date ASC, s.title ASC";

  const sql = `
    SELECT s.*, c.name AS category_name
    FROM subscriptions s
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE ${clauses.join(" AND ")}
    ${orderBy}
  `;
  return { sql, args };
}

export async function loadSubscriptions(filters: {
  categoryId?: number;
  currency?: string;
  dueWithinDays?: number;
  search?: string;
  recordKind?: "all" | "paid" | "free";
  subscriptionStatus?: "active" | "cancelled" | "all";
}): Promise<SubscriptionListRow[]> {
  const db = await getDb();
  const { sql, args } = buildSubscriptionQuery(filters);
  return db.select<SubscriptionListRow>(sql, args);
}

export async function loadSubscriptionsRecent(limit: number): Promise<SubscriptionListRow[]> {
  const db = await getDb();
  const lim = Math.max(1, Math.min(50, limit));
  return db.select<SubscriptionListRow>(
    `SELECT s.*, c.name AS category_name
     FROM subscriptions s
     LEFT JOIN categories c ON c.id = s.category_id
     WHERE s.cancelled_at IS NULL
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT ${lim}`,
  );
}

export async function loadSubscriptionsCancelled(): Promise<SubscriptionListRow[]> {
  return loadSubscriptions({ subscriptionStatus: "cancelled" });
}

export async function loadSubscriptionsDueSoon(limit: number): Promise<SubscriptionListRow[]> {
  const db = await getDb();
  const lim = Math.max(1, Math.min(50, limit));
  return db.select<SubscriptionListRow>(
    `SELECT s.*, c.name AS category_name
     FROM subscriptions s
     LEFT JOIN categories c ON c.id = s.category_id
     WHERE s.billing_model != 'free_account'
       AND s.next_due_date IS NOT NULL AND s.cancelled_at IS NULL
     ORDER BY s.next_due_date ASC, s.title ASC
     LIMIT ${lim}`,
  );
}

export async function loadFreeAccountEmails(): Promise<{ email: string; count: number }[]> {
  const db = await getDb();
  return db.select<{ email: string; count: number }>(
    `SELECT MIN(account_label) AS email, COUNT(*) AS count
     FROM subscriptions
     WHERE billing_model = 'free_account' AND cancelled_at IS NULL
       AND account_label IS NOT NULL AND TRIM(account_label) != ''
     GROUP BY LOWER(TRIM(account_label))
     ORDER BY email ASC`,
  );
}

export async function loadFreeAccountsRecent(limit: number): Promise<SubscriptionListRow[]> {
  const db = await getDb();
  const lim = Math.max(1, Math.min(50, limit));
  return db.select<SubscriptionListRow>(
    `SELECT s.*, c.name AS category_name
     FROM subscriptions s
     LEFT JOIN categories c ON c.id = s.category_id
     WHERE s.billing_model = 'free_account' AND s.cancelled_at IS NULL
     ORDER BY s.updated_at DESC, s.id DESC
     LIMIT ${lim}`,
  );
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
  interval_count: number;
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
  account_label: string | null;
  credit_card_id: number | null;
  wallet_method_id: number | null;
}): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const r = await db.execute(
    `INSERT INTO subscriptions (
      title, notes, website_url, category_id, billing_model, interval_unit, interval_months,
      interval_count, auto_renew, amount_original, currency_code, amount_qar_snapshot, fx_rate_used, fx_quote_at,
      start_date, next_due_date, end_date, is_domain, tags, account_label, credit_card_id, wallet_method_id, cancelled_at, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
    )`,
    [
      row.title,
      row.notes,
      row.website_url,
      row.category_id,
      row.billing_model,
      row.interval_unit,
      row.interval_months,
      row.interval_count,
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
      null,
      row.account_label,
      row.credit_card_id,
      row.wallet_method_id,
      null,
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
    interval_count: number;
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
    account_label: string | null;
    credit_card_id: number | null;
    wallet_method_id: number | null;
  },
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE subscriptions SET
      title = $1, notes = $2, website_url = $3, category_id = $4,
      billing_model = $5, interval_unit = $6, interval_months = $7, interval_count = $8, auto_renew = $9,
      amount_original = $10, currency_code = $11, amount_qar_snapshot = $12,
      fx_rate_used = $13, fx_quote_at = $14, start_date = $15, next_due_date = $16,
      end_date = $17, is_domain = $18, tags = $19, account_label = $20, credit_card_id = $21, wallet_method_id = $22, updated_at = $23
    WHERE id = $24`,
    [
      row.title,
      row.notes,
      row.website_url,
      row.category_id,
      row.billing_model,
      row.interval_unit,
      row.interval_months,
      row.interval_count,
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
      null,
      row.account_label,
      row.credit_card_id,
      row.wallet_method_id,
      now,
      id,
    ],
  );
}

export async function cancelSubscription(id: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  await db.execute(
    "UPDATE subscriptions SET cancelled_at = $1, updated_at = $2 WHERE id = $3",
    [day, now, id],
  );
}

export async function reactivateSubscription(id: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute("UPDATE subscriptions SET cancelled_at = NULL, updated_at = $1 WHERE id = $2", [
    now,
    id,
  ]);
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

export async function confirmSubscriptionPaid(id: number): Promise<void> {
  const sub = await getSubscription(id);
  if (!sub || sub.cancelled_at || sub.billing_model === "free_account" || !sub.next_due_date) return;
  /** Record the billing cycle that was cleared (shown in ledger + Insights by this date). */
  const paidAtCycle = sub.next_due_date;
  const amtOriginal = Number.isFinite(sub.amount_original) ? sub.amount_original : null;
  const nowIso = new Date().toISOString();
  const db = await getDb();
  const insertSql =
    `INSERT INTO payment_events (subscription_id, paid_at, amount_original, currency, amount_qar, renewal_years, renewal_step_count, note)` +
    ` VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`;

  if (sub.billing_model === "recurring" && sub.interval_unit) {
    const cnt = Math.max(1, sub.interval_count ?? 1);
    const base = parseDateInput(sub.next_due_date) ?? new Date();
    const next = addBillingSteps(base, sub.interval_unit, cnt);
    await db.executeTransaction([
      {
        sql: insertSql,
        params: [
          id,
          paidAtCycle,
          amtOriginal,
          sub.currency_code,
          sub.amount_qar_snapshot,
          null,
          cnt,
          PAYMENT_NOTE_MARK_PAID,
        ],
      },
      {
        sql: `UPDATE subscriptions SET next_due_date = $1, updated_at = $2 WHERE id = $3`,
        params: [formatDateInput(next), nowIso, id],
      },
    ]);
    return;
  }

  await db.executeTransaction([
    {
      sql: insertSql,
      params: [
        id,
        paidAtCycle,
        amtOriginal,
        sub.currency_code,
        sub.amount_qar_snapshot,
        null,
        null,
        PAYMENT_NOTE_MARK_PAID,
      ],
    },
    {
      sql: `UPDATE subscriptions SET next_due_date = $1, updated_at = $2 WHERE id = $3`,
      params: [null, nowIso, id],
    },
  ]);
}

export function subscriptionNeedsPaidAttention(sub: Subscription): boolean {
  if (sub.cancelled_at) return false;
  if (sub.billing_model === "free_account") return false;
  if (!sub.next_due_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return sub.next_due_date <= today;
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
  renewalStepCount: number | null,
  note: string | null,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO payment_events (subscription_id, paid_at, amount_original, currency, amount_qar, renewal_years, renewal_step_count, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [subId, paidAt, amountOriginal, currency, amountQar, null, renewalStepCount, note],
  );
}

/** When `'1'`, first-run onboarding has finished. */
export const ONBOARDING_COMPLETE_KEY = "onboarding_complete";

export const PRIMARY_CURRENCY_KEY = "primary_currency";

/** When `'1'`, PIN lock is active (see Electron `setPin` / `clearPin`). */
export const PIN_ENABLED_KEY = "pin_enabled";

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

export async function getPrimaryCurrencyCode(): Promise<string> {
  const v = await getSetting(PRIMARY_CURRENCY_KEY);
  const c = v?.trim().toUpperCase();
  return c && c.length >= 3 ? c : "QAR";
}

export async function statsSummary(): Promise<{
  primaryCode: string;
  currentMonth: { year: number; month: number; totalPrimary: number; dueCount: number };
  nextMonth: { year: number; month: number; totalPrimary: number; dueCount: number };
  currentYearProjected: { year: number; totalPrimary: number; dueCount: number };
  due30Projected: { totalPrimary: number; dueCount: number };
  recurringCount: number;
  byCategory: { name: string; amountPrimary: number }[];
}> {
  const rows = await loadSubscriptions({});
  const primaryCode = await getPrimaryCurrencyCode();
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth();

  const cur = isoCalendarMonthBounds(cy, cm);
  const nextM = cm === 11 ? 0 : cm + 1;
  const nextY = cm === 11 ? cy + 1 : cy;
  const nxt = isoCalendarMonthBounds(nextY, nextM);

  const yStart = `${cy}-01-01`;
  const yEnd = `${cy}-12-31`;

  const curSum = countAndSumCashflowInRange(rows, cur.start, cur.end);
  const nxSum = countAndSumCashflowInRange(rows, nxt.start, nxt.end);
  const yrSum = countAndSumCashflowInRange(rows, yStart, yEnd);

  const today = now.toISOString().slice(0, 10);
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const d30 = in30.toISOString().slice(0, 10);
  const d30Sum = countAndSumCashflowInRange(rows, today, d30);

  const byCategory = cashflowByCategoryInRange(rows, cur.start, cur.end);

  let recurringCount = 0;
  for (const s of rows) {
    if (s.cancelled_at) continue;
    if (s.billing_model === "recurring" && s.amount_qar_snapshot != null) recurringCount++;
  }

  return {
    primaryCode,
    currentMonth: {
      year: cy,
      month: cm + 1,
      totalPrimary: curSum.totalPrimary,
      dueCount: curSum.dueCount,
    },
    nextMonth: {
      year: nextY,
      month: nextM + 1,
      totalPrimary: nxSum.totalPrimary,
      dueCount: nxSum.dueCount,
    },
    currentYearProjected: {
      year: cy,
      totalPrimary: yrSum.totalPrimary,
      dueCount: yrSum.dueCount,
    },
    due30Projected: { totalPrimary: d30Sum.totalPrimary, dueCount: d30Sum.dueCount },
    recurringCount,
    byCategory,
  };
}

const HISTORY_MONTH_CAP = 120;

export async function loadPaymentHistoryByMonth(): Promise<{ ym: string; total: number }[]> {
  const db = await getDb();
  return db.select<{ ym: string; total: number }>(
    `SELECT substr(paid_at, 1, 7) AS ym, SUM(COALESCE(amount_qar, 0)) AS total
     FROM payment_events
     GROUP BY ym
     ORDER BY ym DESC
     LIMIT ${HISTORY_MONTH_CAP}`,
  );
}

export async function loadPaymentHistoryByYear(): Promise<{ year: string; total: number }[]> {
  const db = await getDb();
  return db.select<{ year: string; total: number }>(
    `SELECT substr(paid_at, 1, 4) AS year, SUM(COALESCE(amount_qar, 0)) AS total
     FROM payment_events
     GROUP BY year
     ORDER BY year DESC`,
  );
}

export type PaymentHistoryDetailRow = {
  id: number;
  subscription_id: number;
  subscription_title: string;
  paid_at: string;
  amount_original: number | null;
  currency: string | null;
  amount_qar: number | null;
  note: string | null;
};

const HISTORY_DETAIL_CAP = 500;

/** Recent payments with subscription title for insights history tab. */
export async function loadPaymentHistoryDetails(): Promise<PaymentHistoryDetailRow[]> {
  const db = await getDb();
  return db.select<PaymentHistoryDetailRow>(
    `SELECT pe.id, pe.subscription_id, s.title AS subscription_title,
            pe.paid_at, pe.amount_original, pe.currency, pe.amount_qar, pe.note
     FROM payment_events pe
     INNER JOIN subscriptions s ON s.id = pe.subscription_id
     ORDER BY pe.paid_at DESC, pe.id DESC
     LIMIT ${HISTORY_DETAIL_CAP}`,
  );
}
