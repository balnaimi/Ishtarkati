import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyBackupImport, parseBackupJson } from "./backup";
import {
  AUTO_BACKUP_PREFIX,
  autoBackupSkipReason,
  dbGetSetting,
  flushScheduledBackupForTests,
  isMutatingSql,
  pruneAutoBackupHistory,
  runAutoBackupIfDue,
  runChangeTriggeredBackup,
  runManualAutoBackup,
  scheduleBackupAfterDataChange,
} from "./autoBackup";
import {
  autoBackupStampedFilename,
  latestBackupFilename,
  manualBackupStampedFilename,
} from "./deviceLabel";

const TEST_DEVICE = "test-pc";

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
  opts?: { enabled?: boolean; days?: string; lastAt?: string; deviceName?: string },
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
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run("device_name", opts?.deviceName ?? TEST_DEVICE);
}

describe("isMutatingSql", () => {
  it("detects insert/update/delete", () => {
    expect(isMutatingSql("INSERT INTO subscriptions VALUES (?)")).toBe(true);
    expect(isMutatingSql("UPDATE subscriptions SET title = ?")).toBe(true);
    expect(isMutatingSql("DELETE FROM subscriptions WHERE id = ?")).toBe(true);
    expect(isMutatingSql("SELECT * FROM subscriptions")).toBe(false);
  });
});

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

  it("returns null when configured", () => {
    setAutoBackupSettings(db, tmpDir);
    expect(autoBackupSkipReason(db, NOW_MS)).toBeNull();
  });
});

describe("runChangeTriggeredBackup", () => {
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
    const result = runChangeTriggeredBackup(db, { now: NOW_MS, fileStamp: STAMP });
    expect(result.ran).toBe(false);
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
  });

  it("writes latest and stamped backup on change", () => {
    setAutoBackupSettings(db, tmpDir);
    const result = runChangeTriggeredBackup(db, { now: NOW_MS, fileStamp: STAMP });
    expect(result.ran).toBe(true);
    expect(result.path).toBe(path.join(tmpDir, autoBackupStampedFilename(TEST_DEVICE, STAMP)));

    const files = fs.readdirSync(tmpDir).sort();
    expect(files).toContain(latestBackupFilename(TEST_DEVICE));
    expect(files).toContain(autoBackupStampedFilename(TEST_DEVICE, STAMP));

    const parsed = parseBackupJson(fs.readFileSync(result.path!, "utf8"));
    expect(parsed.exportVersion).toBe(8);
    expect(parsed.subscriptions).toHaveLength(1);
    expect(dbGetSetting(db, "last_auto_backup_at")).toBe(NOW_ISO);
  });

  it("writes again on every trigger (no day interval)", () => {
    setAutoBackupSettings(db, tmpDir, { lastAt: NOW_ISO });
    const result = runChangeTriggeredBackup(db, {
      now: NOW_MS + 60_000,
      fileStamp: "2026-06-07T12-01-00",
    });
    expect(result.ran).toBe(true);
    expect(fs.readdirSync(tmpDir).filter((f) => f.startsWith(AUTO_BACKUP_PREFIX))).toHaveLength(1);
  });

  it("creates backup directory when it does not exist", () => {
    const nested = path.join(tmpDir, "nested", "backups");
    setAutoBackupSettings(db, nested);
    const result = runChangeTriggeredBackup(db, { now: NOW_MS, fileStamp: STAMP });
    expect(result.ran).toBe(true);
    expect(fs.existsSync(nested)).toBe(true);
  });
});

describe("scheduleBackupAfterDataChange", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    db = createMinimalDb();
    seedSampleData(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ishtarkati-debounce-"));
    setAutoBackupSettings(db, tmpDir);
  });

  afterEach(() => {
    flushScheduledBackupForTests();
    vi.useRealTimers();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("debounces rapid changes into one backup", () => {
    scheduleBackupAfterDataChange(db);
    scheduleBackupAfterDataChange(db);
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
    vi.advanceTimersByTime(2_000);
    expect(fs.readdirSync(tmpDir)).toContain(latestBackupFilename(TEST_DEVICE));
  });
});

describe("pruneAutoBackupHistory", () => {
  it("removes auto backups older than retention for this device only", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ishtarkati-prune-"));
    const label = "home-pc";
    try {
      const oldFile = path.join(dir, autoBackupStampedFilename(label, "old"));
      const newFile = path.join(dir, autoBackupStampedFilename(label, "new"));
      const otherDevice = path.join(dir, autoBackupStampedFilename("work-laptop", "old"));
      fs.writeFileSync(oldFile, "{}", "utf8");
      fs.writeFileSync(newFile, "{}", "utf8");
      fs.writeFileSync(otherDevice, "{}", "utf8");
      const oldTime = NOW_MS - 40 * 86400000;
      fs.utimesSync(oldFile, oldTime / 1000, oldTime / 1000);
      fs.utimesSync(otherDevice, oldTime / 1000, oldTime / 1000);
      const removed = pruneAutoBackupHistory(dir, 30, label, NOW_MS);
      expect(removed).toBe(1);
      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(newFile)).toBe(true);
      expect(fs.existsSync(otherDevice)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runAutoBackupIfDue", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = createMinimalDb();
    seedSampleData(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ishtarkati-autobackup-"));
    setAutoBackupSettings(db, tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes when configured (legacy tick alias)", () => {
    const result = runAutoBackupIfDue(db, { now: NOW_MS, fileStamp: STAMP });
    expect(result.ran).toBe(true);
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

  it("writes manual backup file with valid restorable payload and latest", () => {
    const result = runManualAutoBackup(db, { now: NOW_MS, fileStamp: STAMP });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.path).toBe(path.join(tmpDir, manualBackupStampedFilename(TEST_DEVICE, STAMP)));
    expect(fs.existsSync(path.join(tmpDir, latestBackupFilename(TEST_DEVICE)))).toBe(true);
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

  it("updates last_auto_backup_at", () => {
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

  it("change-triggered backup restores to empty database", () => {
    const backup = runChangeTriggeredBackup(db, { now: NOW_MS, fileStamp: STAMP });
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
    } finally {
      empty.close();
    }
  });
});
