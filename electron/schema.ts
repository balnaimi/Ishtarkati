export const SCHEMA_V1_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT,
    website_url TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    billing_model TEXT NOT NULL CHECK (billing_model IN ('one_time', 'recurring', 'pay_as_needed')),
    interval_unit TEXT CHECK (interval_unit IN ('month', 'quarter', 'year', 'custom_months')),
    interval_months INTEGER,
    auto_renew INTEGER NOT NULL DEFAULT 0,
    amount_original REAL NOT NULL,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    amount_qar_snapshot REAL,
    fx_rate_used REAL,
    fx_quote_at TEXT,
    start_date TEXT,
    next_due_date TEXT,
    end_date TEXT,
    is_domain INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payment_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    paid_at TEXT NOT NULL,
    amount_original REAL,
    currency TEXT,
    amount_qar REAL,
    renewal_years INTEGER,
    note TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_subs_category ON subscriptions(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subs_next_due ON subscriptions(next_due_date)`,
];
