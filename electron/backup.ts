import { app, dialog, ipcMain, BrowserWindow } from "electron";
import fs from "node:fs";
import type Database from "better-sqlite3";
import localeAr from "../src/locales/ar.json";

export const BACKUP_EXPORT_VERSION = 6;

export type BackupExportScope = "full" | "without_settings";

export interface BackupPayload {
  exportVersion: number;
  exportScope?: BackupExportScope;
  exportedAt: string;
  appVersion: string;
  categories: unknown[];
  subscriptions: unknown[];
  payment_events: unknown[];
  settings: unknown[];
  currencies: unknown[];
  credit_cards: unknown[];
  wallet_methods: unknown[];
}

export interface ImportPreviewDTO {
  filePath: string;
  exportVersion: number;
  exportScope: BackupExportScope;
  exportedAt: string;
  backupAppVersion: string;
  counts: {
    db: {
      subscriptions: number;
      payment_events: number;
      categories: number;
      credit_cards: number;
      wallet_methods: number;
    };
    file: {
      subscriptions: number;
      payment_events: number;
      categories: number;
      credit_cards: number;
      wallet_methods: number;
    };
  };
  idConflicts: {
    subscriptions: number;
    categories: number;
    credit_cards: number;
    wallet_methods: number;
    payment_events: number;
  };
  similarSubscriptions: Array<{
    importId: number;
    localId: number;
    importTitle: string;
    localTitle: string;
  }>;
  similarTruncated: boolean;
}

export type ImportApplyStrategy = "replace" | "merge";
export type ImportDuplicatePolicy = "keep_local" | "prefer_import";
export type ImportSimilarSubscriptionsPolicy = "keep_both" | "replace_local";

export interface ImportApplyPayload {
  filePath?: string;
  /** Raw backup JSON (inline import without reading a file from disk). */
  json?: string;
  strategy: ImportApplyStrategy;
  onDuplicateId: ImportDuplicatePolicy;
  onSimilarSubscription: ImportSimilarSubscriptionsPolicy;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function normalizeBackupExportScope(raw: unknown): BackupExportScope {
  if (raw === "without_settings" || raw === "subscriptions_only") return "without_settings";
  return "full";
}

/** Legacy «بدون إعدادات»: ملفات قديمة بلا مصفوفات بطاقات/محافظ — نصفّر ربط الاشتراك بوسيلة الدفع عند الاستيراد. */
function withoutSettingsNeedsStripPaymentLinks(data: BackupPayload): boolean {
  if (data.exportScope !== "without_settings") return false;
  return data.credit_cards.length === 0 && data.wallet_methods.length === 0;
}

function importCreditCardDescription(row: Record<string, unknown>): string | null {
  if (!("description" in row) || row.description == null) return null;
  const s = String(row.description).trim();
  return s.length ? s : null;
}

function validatePayload(raw: unknown): BackupPayload {
  if (!isRecord(raw)) throw new Error("Invalid backup file");
  const exportVersion = raw.exportVersion;
  if (
    exportVersion !== 1 &&
    exportVersion !== 2 &&
    exportVersion !== 3 &&
    exportVersion !== 4 &&
    exportVersion !== 5 &&
    exportVersion !== 6
  ) {
    throw new Error(`Unsupported backup version: ${String(exportVersion)}`);
  }
  const exportScope = normalizeBackupExportScope(raw.exportScope);
  const categories = raw.categories;
  const subscriptions = raw.subscriptions;
  const payment_events = raw.payment_events;
  const settings = raw.settings;
  const currencies = Array.isArray(raw.currencies) ? raw.currencies : [];
  const credit_cards = Array.isArray(raw.credit_cards) ? raw.credit_cards : [];
  const wallet_methods = Array.isArray(raw.wallet_methods) ? raw.wallet_methods : [];
  if (!Array.isArray(categories)) throw new Error("Invalid backup: categories");
  if (!Array.isArray(subscriptions)) throw new Error("Invalid backup: subscriptions");
  if (!Array.isArray(payment_events)) throw new Error("Invalid backup: payment_events");
  if (!Array.isArray(settings)) throw new Error("Invalid backup: settings");
  return {
    exportVersion,
    exportScope,
    exportedAt: String(raw.exportedAt ?? ""),
    appVersion: String(raw.appVersion ?? ""),
    categories,
    subscriptions,
    payment_events,
    settings,
    currencies,
    credit_cards,
    wallet_methods,
  };
}

function readBackupFile(path: string): BackupPayload {
  const raw = fs.readFileSync(path, "utf8");
  return parseBackupJson(raw);
}

export function parseBackupJson(raw: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Invalid backup JSON");
  }
  return validatePayload(parsed);
}

export function buildBackupPayloadFromDatabase(
  database: Database.Database,
  scope: BackupExportScope,
): BackupPayload {
  const categories = database.prepare("SELECT * FROM categories ORDER BY id").all();
  const subscriptions = database.prepare("SELECT * FROM subscriptions ORDER BY id").all();
  const payment_events = database.prepare("SELECT * FROM payment_events ORDER BY id").all();
  const settings =
    scope === "without_settings"
      ? []
      : database.prepare("SELECT * FROM settings ORDER BY key").all();
  const currencies = database
    .prepare("SELECT * FROM currencies ORDER BY sort_order, code")
    .all();
  const credit_cards = database.prepare("SELECT * FROM credit_cards ORDER BY id").all();
  const wallet_methods = database.prepare("SELECT * FROM wallet_methods ORDER BY id").all();

  return {
    exportVersion: BACKUP_EXPORT_VERSION,
    exportScope: scope,
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    categories,
    subscriptions,
    payment_events,
    settings,
    currencies,
    credit_cards,
    wallet_methods,
  };
}

function hostnameNorm(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeTitle(t: unknown): string {
  if (t == null) return "";
  return String(t)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Similarity key: normalized title + normalized hostname from URL when present. */
function subscriptionSimilarityKey(title: unknown, websiteUrl: unknown, accountLabel?: unknown): string {
  const acc =
    accountLabel == null || String(accountLabel).trim() === ""
      ? ""
      : String(accountLabel).trim().toLowerCase();
  const host = hostnameNorm(websiteUrl == null ? undefined : String(websiteUrl));
  return `${normalizeTitle(title)}|${host}|${acc}`;
}

type LocalSubBrief = {
  id: number;
  title: string;
  website_url: string | null;
  account_label: string | null;
};

type NormalizedImportSubscription = {
  sourceId: number;
  title: string;
  notes: string | null;
  website_url: string | null;
  category_id: number | null;
  billing_model: string;
  interval_unit: string | null;
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
  credit_card_id: number | null;
  wallet_method_id: number | null;
  account_label: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type NormalizedImportPayment = {
  sourceId: number;
  subscriptionSourceId: number;
  paid_at: string;
  amount_original: number | null;
  currency: string | null;
  amount_qar: number | null;
  renewal_years: number | null;
  renewal_step_count: number | null;
  note: string | null;
};

function normalizeImportedSubscription(row: Record<string, unknown>): NormalizedImportSubscription {
  let billing_model = String(row.billing_model ?? "one_time");
  if (billing_model === "pay_as_needed") billing_model = "one_time";
  if (
    billing_model !== "recurring" &&
    billing_model !== "one_time" &&
    billing_model !== "free_account"
  ) {
    billing_model = "one_time";
  }

  const interval_count =
    "interval_count" in row && row.interval_count != null ? Number(row.interval_count) : 1;

  return {
    sourceId: Number(row.id),
    title: String(row.title ?? ""),
    notes: row.notes == null ? null : String(row.notes),
    website_url: row.website_url == null ? null : String(row.website_url),
    category_id:
      row.category_id == null || row.category_id === "" ? null : Number(row.category_id),
    billing_model,
    interval_unit: row.interval_unit == null ? null : String(row.interval_unit),
    interval_months:
      row.interval_months == null || row.interval_months === ""
        ? null
        : Number(row.interval_months),
    interval_count: Number.isFinite(interval_count) && interval_count > 0 ? interval_count : 1,
    auto_renew: Number(row.auto_renew ?? 0),
    amount_original: Number(row.amount_original ?? 0),
    currency_code: String(row.currency_code ?? "USD").trim().toUpperCase(),
    amount_qar_snapshot:
      row.amount_qar_snapshot == null || row.amount_qar_snapshot === ""
        ? null
        : Number(row.amount_qar_snapshot),
    fx_rate_used:
      row.fx_rate_used == null || row.fx_rate_used === "" ? null : Number(row.fx_rate_used),
    fx_quote_at: row.fx_quote_at == null ? null : String(row.fx_quote_at),
    start_date: row.start_date == null ? null : String(row.start_date),
    next_due_date: row.next_due_date == null ? null : String(row.next_due_date),
    end_date: row.end_date == null ? null : String(row.end_date),
    is_domain: Number(row.is_domain ?? 0),
    credit_card_id:
      "credit_card_id" in row && row.credit_card_id != null && row.credit_card_id !== ""
        ? Number(row.credit_card_id)
        : null,
    wallet_method_id:
      "wallet_method_id" in row && row.wallet_method_id != null && row.wallet_method_id !== ""
        ? Number(row.wallet_method_id)
        : null,
    account_label:
      "account_label" in row && row.account_label != null && String(row.account_label).trim() !== ""
        ? String(row.account_label).trim()
        : null,
    cancelled_at:
      "cancelled_at" in row && row.cancelled_at != null && String(row.cancelled_at).trim() !== ""
        ? String(row.cancelled_at).trim().slice(0, 10)
        : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function normalizeImportedPayment(row: Record<string, unknown>): NormalizedImportPayment {
  const renewal_years =
    row.renewal_years == null || row.renewal_years === "" ? null : Number(row.renewal_years);
  let renewal_step_count =
    "renewal_step_count" in row && row.renewal_step_count != null && row.renewal_step_count !== ""
      ? Number(row.renewal_step_count)
      : null;
  if (
    renewal_step_count == null ||
    !Number.isFinite(renewal_step_count) ||
    renewal_step_count <= 0
  ) {
    renewal_step_count =
      renewal_years != null && Number.isFinite(renewal_years) && renewal_years > 0
        ? renewal_years
        : null;
  }
  return {
    sourceId: Number(row.id),
    subscriptionSourceId: Number(row.subscription_id),
    paid_at: String(row.paid_at ?? ""),
    amount_original:
      row.amount_original == null || row.amount_original === ""
        ? null
        : Number(row.amount_original),
    currency:
      row.currency == null || row.currency === ""
        ? null
        : String(row.currency).trim().toUpperCase(),
    amount_qar: row.amount_qar == null || row.amount_qar === "" ? null : Number(row.amount_qar),
    renewal_years:
      renewal_years != null && Number.isFinite(renewal_years) && renewal_years > 0
        ? renewal_years
        : null,
    renewal_step_count:
      renewal_step_count != null && Number.isFinite(renewal_step_count) && renewal_step_count > 0
        ? Math.floor(renewal_step_count)
        : null,
    note: row.note == null || row.note === "" ? null : String(row.note),
  };
}

export function buildImportPreview(
  database: Database.Database,
  filePath: string,
  data: BackupPayload,
): ImportPreviewDTO {
  const localSubs = database
    .prepare("SELECT id, title, website_url, account_label FROM subscriptions ORDER BY id")
    .all() as LocalSubBrief[];
  const localSubIds = new Set(localSubs.map((s) => s.id));

  const importSubs: NormalizedImportSubscription[] = [];
  for (const row of data.subscriptions) {
    if (!isRecord(row)) continue;
    importSubs.push(normalizeImportedSubscription(row));
  }

  const previewIdConflictsSubs = importSubs.filter((s) => localSubIds.has(s.sourceId)).length;

  const localCatIds = new Set(
    (database.prepare("SELECT id FROM categories").all() as { id: number }[]).map((r) => r.id),
  );
  const previewIdConflictsCats = data.categories.filter(
    (c) => isRecord(c) && localCatIds.has(Number(c.id)),
  ).length;

  const localCardIds = new Set(
    (database.prepare("SELECT id FROM credit_cards").all() as { id: number }[]).map((r) => r.id),
  );
  const previewIdConflictsCards = data.credit_cards.filter(
    (c) => isRecord(c) && localCardIds.has(Number(c.id)),
  ).length;

  const localWalIds = new Set(
    (database.prepare("SELECT id FROM wallet_methods").all() as { id: number }[]).map((r) => r.id),
  );
  const previewIdConflictsWallets = data.wallet_methods.filter(
    (w) => isRecord(w) && localWalIds.has(Number(w.id)),
  ).length;

  const localPayIds = new Set(
    (database.prepare("SELECT id FROM payment_events").all() as { id: number }[]).map((r) => r.id),
  );
  let previewPayConflicts = 0;
  for (const row of data.payment_events) {
    if (!isRecord(row)) continue;
    if (localPayIds.has(Number(row.id))) previewPayConflicts += 1;
  }

  const claimedLocals = new Set<number>();
  const SIM_CAP = 40;
  const similarSubscriptions: ImportPreviewDTO["similarSubscriptions"] = [];
  let similarTruncated = false;

  const sortedImp = [...importSubs].sort((a, b) => a.sourceId - b.sourceId);
  for (const imp of sortedImp) {
    if (localSubIds.has(imp.sourceId)) continue;
    const k = subscriptionSimilarityKey(imp.title, imp.website_url, imp.account_label);

    let picked: LocalSubBrief | undefined;
    for (const loc of localSubs) {
      if (claimedLocals.has(loc.id)) continue;
      if (loc.id === imp.sourceId) continue;
      if (subscriptionSimilarityKey(loc.title, loc.website_url, loc.account_label) !== k) continue;
      picked = loc;
      break;
    }

    if (picked != null) {
      claimedLocals.add(picked.id);
      if (similarSubscriptions.length >= SIM_CAP) {
        similarTruncated = true;
      } else {
        similarSubscriptions.push({
          importId: imp.sourceId,
          localId: picked.id,
          importTitle: imp.title,
          localTitle: picked.title,
        });
      }
    }
  }

  const countRow = database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM subscriptions) AS s,
      (SELECT COUNT(*) FROM payment_events) AS p,
      (SELECT COUNT(*) FROM categories) AS c,
      (SELECT COUNT(*) FROM credit_cards) AS k,
      (SELECT COUNT(*) FROM wallet_methods) AS w
    `).get() as {
    s: number;
    p: number;
    c: number;
    k: number;
    w: number;
  };

  return {
    filePath,
    exportVersion: data.exportVersion,
    exportScope: data.exportScope ?? "full",
    exportedAt: data.exportedAt,
    backupAppVersion: data.appVersion,
    counts: {
      db: {
        subscriptions: countRow?.s ?? 0,
        payment_events: countRow?.p ?? 0,
        categories: countRow?.c ?? 0,
        credit_cards: countRow?.k ?? 0,
        wallet_methods: countRow?.w ?? 0,
      },
      file: {
        subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions.length : 0,
        payment_events: Array.isArray(data.payment_events) ? data.payment_events.length : 0,
        categories: Array.isArray(data.categories) ? data.categories.length : 0,
        credit_cards: data.credit_cards.length,
        wallet_methods: data.wallet_methods.length,
      },
    },
    idConflicts: {
      subscriptions: previewIdConflictsSubs,
      categories: previewIdConflictsCats,
      credit_cards: previewIdConflictsCards,
      wallet_methods: previewIdConflictsWallets,
      payment_events: previewPayConflicts,
    },
    similarSubscriptions,
    similarTruncated,
  };
}

function resetAutoincrement(database: Database.Database, table: string): void {
  const row = database.prepare(`SELECT MAX(id) AS m FROM ${table}`).get() as {
    m: number | null;
  };
  const m = row.m ?? 0;
  database.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
  if (m > 0) {
    database.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)").run(table, m);
  }
}

function subscriptionRowParams(
  r: NormalizedImportSubscription,
  finalId: number,
): unknown[] {
  return [
    finalId,
    r.title,
    r.notes,
    r.website_url,
    r.category_id,
    r.billing_model,
    r.interval_unit,
    r.interval_months,
    r.interval_count,
    r.auto_renew,
    r.amount_original,
    r.currency_code,
    r.amount_qar_snapshot,
    r.fx_rate_used,
    r.fx_quote_at,
    r.start_date,
    r.next_due_date,
    r.end_date,
    r.is_domain,
    null,
    r.credit_card_id,
    r.wallet_method_id,
    r.account_label,
    r.cancelled_at,
    r.created_at,
    r.updated_at,
  ];
}

function insertBackupPayloadSnapshot(
  database: Database.Database,
  data: BackupPayload,
  stripPayLinks: boolean,
): void {
  const insCard = database.prepare(`
      INSERT INTO credit_cards (id, brand, last4, exp_month, exp_year, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  for (const row of data.credit_cards) {
    if (!isRecord(row)) throw new Error("Invalid credit card row");
    insCard.run(
      row.id,
      row.brand,
      row.last4,
      row.exp_month,
      row.exp_year,
      importCreditCardDescription(row),
      row.created_at,
      row.updated_at,
    );
  }

  const insWallet = database.prepare(`
      INSERT INTO wallet_methods (id, service_code, account_text, linked_card_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
  for (const row of data.wallet_methods) {
    if (!isRecord(row)) throw new Error("Invalid wallet row");
    insWallet.run(
      row.id,
      row.service_code,
      row.account_text,
      row.linked_card_id ?? null,
      row.created_at,
      row.updated_at,
    );
  }

  const insCurPrefer = database.prepare(`
      INSERT INTO currencies (code, sort_order)
      VALUES (?, ?)
      ON CONFLICT(code) DO UPDATE SET sort_order = excluded.sort_order
    `);
  for (const row of data.currencies) {
    if (!isRecord(row)) throw new Error("Invalid currency row");
    insCurPrefer.run(String(row.code).trim().toUpperCase(), Number(row.sort_order) || 0);
  }

  const insCat = database.prepare(
    "INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)",
  );
  for (const row of data.categories) {
    if (!isRecord(row)) throw new Error("Invalid category row");
    insCat.run(row.id, row.name, row.sort_order);
  }

  const insSub = database.prepare(`
      INSERT INTO subscriptions (
        id, title, notes, website_url, category_id, billing_model, interval_unit, interval_months,
        interval_count, auto_renew, amount_original, currency_code, amount_qar_snapshot, fx_rate_used, fx_quote_at,
        start_date, next_due_date, end_date, is_domain, tags, credit_card_id, wallet_method_id,
        account_label, cancelled_at, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
  for (const row of data.subscriptions) {
    if (!isRecord(row)) throw new Error("Invalid subscription row");
    const raw = normalizeImportedSubscription(row);
    const r = stripPayLinks
      ? { ...raw, credit_card_id: null as number | null, wallet_method_id: null as number | null }
      : raw;
    insSub.run(...subscriptionRowParams(r, r.sourceId));
  }

  const insPay = database.prepare(`
      INSERT INTO payment_events (
        id, subscription_id, paid_at, amount_original, currency, amount_qar, renewal_years, renewal_step_count, note
      ) VALUES (?,?,?,?,?,?,?,?,?)
    `);
  for (const row of data.payment_events) {
    if (!isRecord(row)) throw new Error("Invalid payment row");
    const pv = normalizeImportedPayment(row);
    insPay.run(
      pv.sourceId,
      pv.subscriptionSourceId,
      pv.paid_at,
      pv.amount_original,
      pv.currency,
      pv.amount_qar,
      pv.renewal_years,
      pv.renewal_step_count,
      pv.note,
    );
  }
}

function resetBackupTableSequences(database: Database.Database): void {
  resetAutoincrement(database, "categories");
  resetAutoincrement(database, "subscriptions");
  resetAutoincrement(database, "payment_events");
  resetAutoincrement(database, "credit_cards");
  resetAutoincrement(database, "wallet_methods");
}

function importIntoDb(database: Database.Database, data: BackupPayload): void {
  const scope = data.exportScope ?? "full";
  const tx = database.transaction(() => {
    if (scope === "without_settings") {
      const stripPayLinks = withoutSettingsNeedsStripPaymentLinks(data);
      database.prepare("DELETE FROM payment_events").run();
      database.prepare("DELETE FROM subscriptions").run();
      database.prepare("DELETE FROM wallet_methods").run();
      database.prepare("DELETE FROM credit_cards").run();
      database.prepare("DELETE FROM categories").run();
      database.prepare("DELETE FROM currencies").run();
      insertBackupPayloadSnapshot(database, data, stripPayLinks);
      resetBackupTableSequences(database);
      return;
    }

    database.prepare("DELETE FROM payment_events").run();
    database.prepare("DELETE FROM subscriptions").run();
    database.prepare("DELETE FROM wallet_methods").run();
    database.prepare("DELETE FROM credit_cards").run();
    database.prepare("DELETE FROM categories").run();
    database.prepare("DELETE FROM currencies").run();
    database.prepare("DELETE FROM settings").run();

    insertBackupPayloadSnapshot(database, data, false);

    const insSet = database.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?)",
    );
    for (const row of data.settings) {
      if (!isRecord(row)) throw new Error("Invalid settings row");
      insSet.run(row.key, row.value);
    }

    resetBackupTableSequences(database);
  });
  tx();
}

function mergeImportIntoDb(
  database: Database.Database,
  data: BackupPayload,
  opts: { onDuplicateId: ImportDuplicatePolicy; onSimilarSubscription: ImportSimilarSubscriptionsPolicy },
): void {
  const { onDuplicateId, onSimilarSubscription } = opts;
  const preferDup = onDuplicateId === "prefer_import";
  const stripPay = withoutSettingsNeedsStripPaymentLinks(data);

  const tx = database.transaction(() => {
    const insCurPrefer = database.prepare(`
      INSERT INTO currencies (code, sort_order)
      VALUES (?, ?)
      ON CONFLICT(code) DO UPDATE SET sort_order = excluded.sort_order
    `);
    const insCurKeep = database.prepare(`
      INSERT OR IGNORE INTO currencies (code, sort_order) VALUES (?, ?)
    `);
    for (const row of data.currencies) {
      if (!isRecord(row)) throw new Error("Invalid currency row");
      const bind = [String(row.code).trim().toUpperCase(), Number(row.sort_order) || 0];
      preferDup ? insCurPrefer.run(...bind) : insCurKeep.run(...bind);
    }

    const catExists = database.prepare("SELECT id FROM categories WHERE id = ?");
    const catInsert = database.prepare(
      "INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)",
    );
    const catUpdate = database.prepare(
      "UPDATE categories SET name = ?, sort_order = ? WHERE id = ?",
    );
    for (const row of data.categories) {
      if (!isRecord(row)) throw new Error("Invalid category row");
      const id = Number(row.id);
      if (catExists.get(id)) {
        if (preferDup) catUpdate.run(row.name, row.sort_order, id);
      } else {
        catInsert.run(id, row.name, row.sort_order);
      }
    }

    const cardExists = database.prepare("SELECT id FROM credit_cards WHERE id = ?");
    const cardInsert = database.prepare(`
      INSERT INTO credit_cards (id, brand, last4, exp_month, exp_year, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const cardUpdate = database.prepare(`
      UPDATE credit_cards SET brand = ?, last4 = ?, exp_month = ?, exp_year = ?, description = ?,
      created_at = ?, updated_at = ? WHERE id = ?
    `);
    for (const row of data.credit_cards) {
      if (!isRecord(row)) throw new Error("Invalid credit card row");
      const id = Number(row.id);
      const desc = importCreditCardDescription(row);
      if (cardExists.get(id)) {
        if (preferDup)
          cardUpdate.run(
            row.brand,
            row.last4,
            row.exp_month,
            row.exp_year,
            desc,
            row.created_at,
            row.updated_at,
            id,
          );
      } else {
        cardInsert.run(
          id,
          row.brand,
          row.last4,
          row.exp_month,
          row.exp_year,
          desc,
          row.created_at,
          row.updated_at,
        );
      }
    }

    const walExists = database.prepare("SELECT id FROM wallet_methods WHERE id = ?");
    const walInsert = database.prepare(`
      INSERT INTO wallet_methods (id, service_code, account_text, linked_card_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const walUpdate = database.prepare(`
      UPDATE wallet_methods SET service_code = ?, account_text = ?, linked_card_id = ?, created_at = ?, updated_at = ?
      WHERE id = ?
    `);
    for (const row of data.wallet_methods) {
      if (!isRecord(row)) throw new Error("Invalid wallet row");
      const id = Number(row.id);
      const lc = row.linked_card_id ?? null;
      const ca = row.created_at;
      const ua = row.updated_at;
      if (walExists.get(id)) {
        if (preferDup) walUpdate.run(row.service_code, row.account_text, lc, ca, ua, id);
      } else {
        walInsert.run(id, row.service_code, row.account_text, lc, ca, ua);
      }
    }

    const localRowsFull = database
      .prepare("SELECT id, title, website_url, account_label FROM subscriptions ORDER BY id")
      .all() as LocalSubBrief[];

    const importNormSubs = data.subscriptions.map((row) => {
      if (!isRecord(row)) throw new Error("Invalid subscription row");
      let s = normalizeImportedSubscription(row);
      if (stripPay) {
        s = { ...s, credit_card_id: null, wallet_method_id: null };
      }
      return s;
    });
    importNormSubs.sort((a, b) => a.sourceId - b.sourceId);

    const occupied =
      new Set(
        (database.prepare("SELECT id FROM subscriptions").all() as { id: number }[]).map((r) => r.id),
      );

    let seq =
      Number(
        (database.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM subscriptions").get() as {
          m: number | null;
        }).m ?? 0,
      );

    function takeSubscriptionId(desired: number): number {
      if (!occupied.has(desired)) {
        occupied.add(desired);
        if (desired > seq) seq = desired;
        return desired;
      }
      seq += 1;
      while (occupied.has(seq)) seq += 1;
      occupied.add(seq);
      return seq;
    }

    const pickedSimLocals = new Set<number>();
    const remapSubs = new Map<number, number>();

    function findSimMate(imp: NormalizedImportSubscription): LocalSubBrief | undefined {
      const k = subscriptionSimilarityKey(imp.title, imp.website_url, imp.account_label);
      for (const L of localRowsFull) {
        if (pickedSimLocals.has(L.id)) continue;
        if (L.id === imp.sourceId) continue;
        if (subscriptionSimilarityKey(L.title, L.website_url, L.account_label) !== k) continue;
        return L;
      }
      return undefined;
    }

    const insSub = database.prepare(`
      INSERT INTO subscriptions (
        id, title, notes, website_url, category_id, billing_model, interval_unit, interval_months,
        interval_count, auto_renew, amount_original, currency_code, amount_qar_snapshot, fx_rate_used, fx_quote_at,
        start_date, next_due_date, end_date, is_domain, tags, credit_card_id, wallet_method_id,
        account_label, cancelled_at, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const updSub = database.prepare(`
      UPDATE subscriptions SET
        title = ?, notes = ?, website_url = ?, category_id = ?, billing_model = ?, interval_unit = ?,
        interval_months = ?, interval_count = ?, auto_renew = ?, amount_original = ?, currency_code = ?,
        amount_qar_snapshot = ?, fx_rate_used = ?, fx_quote_at = ?, start_date = ?, next_due_date = ?,
        end_date = ?, is_domain = ?, tags = ?, credit_card_id = ?, wallet_method_id = ?,
        account_label = ?, cancelled_at = ?, created_at = ?, updated_at = ?
      WHERE id = ?
    `);
    const delSub = database.prepare("DELETE FROM subscriptions WHERE id = ?");

    for (const imp of importNormSubs) {
      const idOccupied = occupied.has(imp.sourceId);

      if (idOccupied && preferDup) {
        updSub.run(
          imp.title,
          imp.notes,
          imp.website_url,
          imp.category_id,
          imp.billing_model,
          imp.interval_unit,
          imp.interval_months,
          imp.interval_count,
          imp.auto_renew,
          imp.amount_original,
          imp.currency_code,
          imp.amount_qar_snapshot,
          imp.fx_rate_used,
          imp.fx_quote_at,
          imp.start_date,
          imp.next_due_date,
          imp.end_date,
          imp.is_domain,
          null,
          imp.credit_card_id,
          imp.wallet_method_id,
          imp.account_label,
          imp.cancelled_at,
          imp.created_at,
          imp.updated_at,
          imp.sourceId,
        );
        continue;
      }

      if (idOccupied && !preferDup) {
        continue;
      }

      const mate = findSimMate(imp);
      if (mate != null) {
        pickedSimLocals.add(mate.id);
        if (onSimilarSubscription === "replace_local") {
          delSub.run(mate.id);
          occupied.delete(mate.id);
        }
      }

      const fid = takeSubscriptionId(imp.sourceId);
      if (fid !== imp.sourceId) {
        remapSubs.set(imp.sourceId, fid);
      }
      insSub.run(...subscriptionRowParams(imp, fid));
    }

    const payExists = database.prepare("SELECT id FROM payment_events WHERE id = ?");
    const insPay = database.prepare(`
      INSERT INTO payment_events (
        id, subscription_id, paid_at, amount_original, currency, amount_qar, renewal_years, renewal_step_count, note
      ) VALUES (?,?,?,?,?,?,?,?,?)
    `);
    const updPay = database.prepare(`
      UPDATE payment_events SET subscription_id = ?, paid_at = ?, amount_original = ?, currency = ?,
      amount_qar = ?, renewal_years = ?, renewal_step_count = ?, note = ? WHERE id = ?
    `);

    const importNormPays = data.payment_events.map((row) => {
      if (!isRecord(row)) throw new Error("Invalid payment row");
      return normalizeImportedPayment(row);
    });
    importNormPays.sort((a, b) => a.sourceId - b.sourceId);

    const subProbe = database.prepare("SELECT id FROM subscriptions WHERE id = ?");

    for (const pv of importNormPays) {
      const sidFinal = remapSubs.get(pv.subscriptionSourceId) ?? pv.subscriptionSourceId;
      if (!subProbe.get(sidFinal)) continue;

      if (payExists.get(pv.sourceId)) {
        if (preferDup) {
          updPay.run(
            sidFinal,
            pv.paid_at,
            pv.amount_original,
            pv.currency,
            pv.amount_qar,
            pv.renewal_years,
            pv.renewal_step_count,
            pv.note,
            pv.sourceId,
          );
        }
      } else {
        insPay.run(
          pv.sourceId,
          sidFinal,
          pv.paid_at,
          pv.amount_original,
          pv.currency,
          pv.amount_qar,
          pv.renewal_years,
          pv.renewal_step_count,
          pv.note,
        );
      }
    }

    resetAutoincrement(database, "categories");
    resetAutoincrement(database, "subscriptions");
    resetAutoincrement(database, "payment_events");
    resetAutoincrement(database, "credit_cards");
    resetAutoincrement(database, "wallet_methods");
  });
  tx();
}

export function applyBackupImport(
  database: Database.Database,
  data: BackupPayload,
  opts: {
    strategy: ImportApplyStrategy;
    onDuplicateId: ImportDuplicatePolicy;
    onSimilarSubscription: ImportSimilarSubscriptionsPolicy;
  },
): void {
  if (opts.strategy === "replace") {
    importIntoDb(database, data);
    return;
  }
  mergeImportIntoDb(database, data, {
    onDuplicateId: opts.onDuplicateId,
    onSimilarSubscription: opts.onSimilarSubscription,
  });
}

function isApplyPayload(raw: unknown): raw is ImportApplyPayload {
  if (!isRecord(raw)) return false;
  const hasFile = typeof raw.filePath === "string" && String(raw.filePath).length > 0;
  const hasJson = typeof raw.json === "string" && String(raw.json).length > 0;
  if (!hasFile && !hasJson) return false;
  if (raw.strategy !== "replace" && raw.strategy !== "merge") return false;
  if (raw.onDuplicateId !== "keep_local" && raw.onDuplicateId !== "prefer_import") return false;
  if (
    raw.onSimilarSubscription !== "keep_both" &&
    raw.onSimilarSubscription !== "replace_local"
  ) {
    return false;
  }
  return true;
}

export function registerBackupIpc(
  getDb: () => Database.Database | null,
  getWin: () => BrowserWindow | null,
  onDataChanged?: () => void,
): void {
  ipcMain.handle("backup:export", async (_evt, raw?: unknown) => {
    let scope: BackupExportScope = "full";
    const reqScope =
      raw != null && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as { scope?: string }).scope
        : undefined;
    if (reqScope === "without_settings" || reqScope === "subscriptions_only") {
      scope = "without_settings";
    }
    const database = getDb();
    const w = getWin();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!w) return { ok: false as const, error: "no-window" };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const defaultPath =
      scope === "without_settings"
        ? `ishtarkati-data-${stamp}.json`
        : `ishtarkati-backup-${stamp}.json`;
    const { filePath, canceled } = await dialog.showSaveDialog(w, {
      title: localeAr.electron.backupSaveTitle,
      defaultPath,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { ok: false as const, canceled: true };

    const payload = buildBackupPayloadFromDatabase(database, scope);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    return { ok: true as const, path: filePath };
  });

  ipcMain.handle("backup:prepareImport", async () => {
    const database = getDb();
    const w = getWin();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!w) return { ok: false as const, error: "no-window" };

    const { filePaths, canceled } = await dialog.showOpenDialog(w, {
      title: localeAr.electron.backupOpenTitle,
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePaths?.[0]) return { ok: false as const, canceled: true };

    try {
      const data = readBackupFile(filePaths[0]);
      const preview = buildImportPreview(database, filePaths[0], data);
      return { ok: true as const, preview };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle("backup:applyImport", async (_evt, raw: unknown) => {
    const database = getDb();
    if (!database) return { ok: false as const, error: "no-database" };
    if (!isApplyPayload(raw)) return { ok: false as const, error: "invalid-import-options" };

    try {
      let data: BackupPayload;
      if (typeof raw.json === "string" && raw.json.length > 0) {
        data = parseBackupJson(raw.json);
      } else if (typeof raw.filePath === "string" && raw.filePath.length > 0) {
        data = readBackupFile(raw.filePath);
      } else {
        return { ok: false as const, error: "missing-backup-source" };
      }
      applyBackupImport(database, data, {
        strategy: raw.strategy,
        onDuplicateId: raw.onDuplicateId,
        onSimilarSubscription: raw.onSimilarSubscription,
      });
      onDataChanged?.();
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: msg };
    }
  });
}
