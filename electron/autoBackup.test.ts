import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyBackupImport, parseBackupJson } from "./backup";
import {
  autoBackupSkipReason,
  dbGetSetting,
  runAutoBackupIfDue,
  runManualAutoBackup,
} from "./autoBackup";

vi.mock("electron", () => ({
  app: { getVersion: () => "4.20.0-test" },
}));

const NOW_MS = Date.parse("2026-06-07T12:00:00.000Z");
const STAMP = "2026-06-07T12-00-00";
const NOW_ISO = "2026-06-07T12:00:00.000Z";

function createMinimalDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      notes TEXT,
      website_url TEXT,
      category_id INTEGER,
      billing_model TEXT NOT NULL,
      interval_unit TEXT,
      interval_months INTEGER,
      interval_count INTEGER NOT NULL DEFAULT 1,
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
      tags TEXT,
      credit_card_id INTEGER,
      wallet_method_id INTEGER,
      account_label TEXT,
      cancelled_at TEXT,
      trial_ends_on TEXT,
      renewal_cancelled INTEGER NOT NULL DEFAULT 0,
      platform_type TEXT NOT NULL DEFAULT 'website',
      login_username TEXT,
      login_phone TEXT,
      recovery_contact TEXT,
      recovery_contact_kind TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE payment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      paid_at TEXT NOT NULL,
      amount_original REAL,
      currency TEXT,
      amount_qar REAL,
      renewal_years INTEGER,
      renewal_step_count INTEGER,
      note TEXT
    );
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE credit_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      last4 TEXT NOT NULL,
      exp_month INTEGER NOT NULL,
      exp_year INTEGER NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE wallet_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_code TEXT NOT NULL,
      account_text TEXT NOT NULL,
      linked_card_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE currencies (
      code TEXT PRIMARY KEY COLLATE NOCASE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);
  return db;
}

function seedSampleData(db: Database.Database): void {
  db.prepare(
    `INSERT INTO subscriptions (
      id, title, billing_model, amount_original, currency_code, interval_count, auto_renew, is_domain,
      tags, trial_ends_on, renewal_cancelled, created_at, updated_at
    ) VALUES (1, 'Netflix', 'recurring', 50, 'QAR', 1, 1, 0, 'streaming', NULL, 0, ?, ?)`,
  ).run(NOW_ISO, NOW_ISO);
  db.prepare("INSERT INTO settings (key, value) VALUES ('primary_currency', 'QAR')").run();
}

function setAutoBackupSettings(
  db: Database.Database,
  dir: string | null,
  opts?: { enabled?: boolean; days?: string; lastAt?: string },
): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run("auto_backup_enabled", opts?.enabled === false ? "0" : "1");
  if (dir != null) {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run("auto_backup_dir", dir);
  }
  if (opts?.days != null) {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run("auto_backup_days", opts.days);
  }
  if (opts?.lastAt != null) {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run("last_auto_backup_at", opts.lastAt);
  }
}

describe("autoBackupSkipReason", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = createMinimalDb();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ishtarkati-autobackup-"));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns disabled when auto backup is off", () => {
    setAutoBackupSettings(db, tmpDir, { enabled: false });
    expect(autoBackupSkipReason(db, NOW_MS)).toBe("disabled");
  });

  it("returns no-dir when folder is unset", () => {
    setAutoBackupSettings(db, null);
    expect(autoBackupSkipReason(db, NOW_MS)).toBe("no-dir");
  });

  it("returns not-due when interval has not elapsed", () => {
    const threeDaysAgo = new Date(NOW_MS - 3 * 86400000).toISOString();
    setAutoBackupSettings(db, tmpDir, { days: "7", lastAt: threeDaysAgo });
    expect(autoBackupSkipReason(db, NOW_MS)).toBe("not-due");
  });

  it("returns null when backup is due (first run)", () => {
    setAutoBackupSettings(db, tmpDir);
    expect(autoBackupSkipReason(db, NOW_MS)).toBeNull();
  });

  it("returns null when interval has elapsed", () => {
    const tenDaysAgo = new Date(NOW_MS - 10 * 86400000).toISOString();
    setAutoBackupSettings(db, tmpDir, { days: "7", lastAt: tenDaysAgo });
    expect(autoBackupSkipReason(db, NOW_MS)).toBeNull();
  });
});

describe("runAutoBackupIfDue", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = createMinimalDb();
    seedSampleData(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ishtarkati-autobackup-"));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not write when disabled", () => {
    setAutoBackupSettings(db, tmpDir, { enabled: false });
    const result = runAutoBackupIfDue(db, { now: NOW_MS, fileStamp: STAMP });
    expect(result.ran).toBe(false);
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
    expect(dbGetSetting(db, "last_auto_backup_at")).toBeNull();
  });

  it("returns no-dir error when folder is missing", () => {
    setAutoBackupSettings(db, null);
    const result = runAutoBackupIfDue(db, { now: NOW_MS });
    expect(result).toEqual({ ran: false, error: "no-dir" });
  });

  it("writes auto backup on first run and updates last_auto_backup_at", () => {
    setAutoBackupSettings(db, tmpDir);
    const result = runAutoBackupIfDue(db, { now: NOW_MS, fileStamp: STAMP });
    expect(result.ran).toBe(true);
    expect(result.path).toBe(path.join(tmpDir, "ishtarkati-auto-2026-06-07T12-00-00.json"));

    const files = fs.readdirSync(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^ishtarkati-auto-/);

    const parsed = parseBackupJson(fs.readFileSync(result.path!, "utf8"));
    expect(parsed.exportVersion).toBe(8);
    expect(parsed.subscriptions).toHaveLength(1);

    expect(dbGetSetting(db, "last_auto_backup_at")).toBe(NOW_ISO);
  });

  it("skips when within interval", () => {
    setAutoBackupSettings(db, tmpDir, { days: "7", lastAt: NOW_ISO });
    const result = runAutoBackupIfDue(db, { now: NOW_MS + 2 * 86400000, fileStamp: STAMP });
    expect(result.ran).toBe(false);
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
  });

  it("writes again after interval elapses", () => {
    setAutoBackupSettings(db, tmpDir, { days: "3", lastAt: NOW_ISO });
    const later = NOW_MS + 4 * 86400000;
    const result = runAutoBackupIfDue(db, { now: later, fileStamp: "2026-06-11T12-00-00" });
    expect(result.ran).toBe(true);
    expect(fs.readdirSync(tmpDir)).toHaveLength(1);
    expect(dbGetSetting(db, "last_auto_backup_at")).toBe(new Date(later).toISOString());
  });

  it("creates backup directory when it does not exist", () => {
    const nested = path.join(tmpDir, "nested", "backups");
    setAutoBackupSettings(db, nested);
    const result = runAutoBackupIfDue(db, { now: NOW_MS, fileStamp: STAMP });
    expect(result.ran).toBe(true);
    expect(fs.existsSync(nested)).toBe(true);
  });
});

describe("runManualAutoBackup", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = createMinimalDb();
    seedSampleData(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ishtarkati-manualbackup-"));
    setAutoBackupSettings(db, tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes manual backup file with valid restorable payload", () => {
    const result = runManualAutoBackup(db, { now: NOW_MS, fileStamp: STAMP });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.path).toBe(path.join(tmpDir, "ishtarkati-manual-2026-06-07T12-00-00.json"));
    const parsed = parseBackupJson(fs.readFileSync(result.path, "utf8"));

    const restored = createMinimalDb();
    try {
      applyBackupImport(restored, parsed, {
        strategy: "replace",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });
      const row = restored
        .prepare("SELECT title, tags FROM subscriptions WHERE id = 1")
        .get() as { title: string; tags: string };
      expect(row.title).toBe("Netflix");
      expect(row.tags).toBe("streaming");
    } finally {
      restored.close();
    }
  });

  it("updates last_auto_backup_at like scheduled backup", () => {
    runManualAutoBackup(db, { now: NOW_MS, fileStamp: STAMP });
    expect(dbGetSetting(db, "last_auto_backup_at")).toBe(NOW_ISO);
  });
});

describe("auto backup restore pipeline", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = createMinimalDb();
    seedSampleData(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ishtarkati-restore-"));
    setAutoBackupSettings(db, tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("auto backup file restores to empty database with matching subscription", () => {
    const backup = runAutoBackupIfDue(db, { now: NOW_MS, fileStamp: STAMP });
    expect(backup.ran).toBe(true);

    const empty = createMinimalDb();
    try {
      const parsed = parseBackupJson(fs.readFileSync(backup.path!, "utf8"));
      applyBackupImport(empty, parsed, {
        strategy: "replace",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });
      const count = empty.prepare("SELECT COUNT(*) AS n FROM subscriptions").get() as { n: number };
      expect(count.n).toBe(1);
      const title = empty.prepare("SELECT title FROM subscriptions WHERE id = 1").get() as {
        title: string;
      };
      expect(title.title).toBe("Netflix");
    } finally {
      empty.close();
    }
  });
});
