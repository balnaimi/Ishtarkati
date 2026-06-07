import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyBackupImport,
  buildBackupPayloadFromDatabase,
  buildImportPreview,
  parseBackupJson,
  type BackupPayload,
} from "./backup";

vi.mock("electron", () => ({
  app: { getVersion: () => "3.0.0-test" },
  dialog: {},
  ipcMain: { handle: vi.fn() },
}));

const NOW = "2026-06-07T12:00:00.000Z";

function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
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
      linked_card_id INTEGER REFERENCES credit_cards(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      notes TEXT,
      website_url TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
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
      credit_card_id INTEGER REFERENCES credit_cards(id) ON DELETE SET NULL,
      wallet_method_id INTEGER REFERENCES wallet_methods(id) ON DELETE SET NULL,
      account_label TEXT,
      cancelled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE payment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      paid_at TEXT NOT NULL,
      amount_original REAL,
      currency TEXT,
      amount_qar REAL,
      renewal_years INTEGER,
      renewal_step_count INTEGER,
      note TEXT
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

function seedDeviceA(db: Database.Database): void {
  db.prepare("INSERT INTO categories (id, name, sort_order) VALUES (1, 'سحابة', 0)").run();
  db.prepare("INSERT INTO currencies (code, sort_order) VALUES ('QAR', 0)").run();
  db.prepare(
    `INSERT INTO subscriptions (
      id, title, billing_model, amount_original, currency_code, created_at, updated_at, interval_count
    ) VALUES (1, 'Netflix', 'recurring', 50, 'QAR', ?, ?, 1)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO payment_events (id, subscription_id, paid_at) VALUES (1, 1, '2026-01-01')`,
  ).run();
  db.prepare("INSERT INTO settings (key, value) VALUES ('primary_currency', 'QAR')").run();
  db.prepare("INSERT INTO settings (key, value) VALUES ('reminders_enabled', '1')").run();
}

function countRow(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n;
}

describe("parseBackupJson", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseBackupJson("{")).toThrow(/Invalid backup JSON/);
  });

  it("rejects unsupported export version", () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          exportVersion: 99,
          categories: [],
          subscriptions: [],
          payment_events: [],
          settings: [],
        }),
      ),
    ).toThrow(/Unsupported backup version/);
  });

  it("accepts legacy v5 payloads", () => {
    const data = parseBackupJson(
      JSON.stringify({
        exportVersion: 5,
        exportedAt: NOW,
        appVersion: "1.0.0",
        categories: [],
        subscriptions: [],
        payment_events: [],
        settings: [],
      }),
    );
    expect(data.exportVersion).toBe(5);
    expect(data.currencies).toEqual([]);
  });
});

describe("full backup round-trip (device A → device B)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it("replace restores identical data on empty database", () => {
    seedDeviceA(db);
    const payload = buildBackupPayloadFromDatabase(db, "full");
    const json = JSON.stringify(payload);

    const deviceB = createTestDatabase();
    try {
      applyBackupImport(deviceB, parseBackupJson(json), {
        strategy: "replace",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });
      expect(countRow(deviceB, "subscriptions")).toBe(1);
      expect(countRow(deviceB, "payment_events")).toBe(1);
      expect(countRow(deviceB, "categories")).toBe(1);
      expect(countRow(deviceB, "settings")).toBe(2);
      const title = deviceB.prepare("SELECT title FROM subscriptions WHERE id = 1").get() as {
        title: string;
      };
      expect(title.title).toBe("Netflix");
    } finally {
      deviceB.close();
    }
  });

  it("replace overwrites existing data on device B", () => {
    seedDeviceA(db);
    const payload = buildBackupPayloadFromDatabase(db, "full");

    const deviceB = createTestDatabase();
    try {
      deviceB.prepare(
        `INSERT INTO subscriptions (id, title, billing_model, amount_original, currency_code, created_at, updated_at, interval_count)
         VALUES (9, 'قديم', 'one_time', 1, 'USD', ?, ?, 1)`,
      ).run(NOW, NOW);

      applyBackupImport(deviceB, payload, {
        strategy: "replace",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });

      expect(countRow(deviceB, "subscriptions")).toBe(1);
      const row = deviceB.prepare("SELECT title FROM subscriptions").get() as { title: string };
      expect(row.title).toBe("Netflix");
    } finally {
      deviceB.close();
    }
  });
});

describe("merge import", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it("keep_local skips duplicate subscription id", () => {
    seedDeviceA(db);
    const payload = buildBackupPayloadFromDatabase(db, "full");

    const deviceB = createTestDatabase();
    try {
      deviceB.prepare(
        `INSERT INTO subscriptions (id, title, billing_model, amount_original, currency_code, created_at, updated_at, interval_count)
         VALUES (1, 'محلي', 'one_time', 10, 'QAR', ?, ?, 1)`,
      ).run(NOW, NOW);

      applyBackupImport(deviceB, payload, {
        strategy: "merge",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });

      const row = deviceB.prepare("SELECT title FROM subscriptions WHERE id = 1").get() as {
        title: string;
      };
      expect(row.title).toBe("محلي");
    } finally {
      deviceB.close();
    }
  });

  it("prefer_import updates duplicate subscription id", () => {
    seedDeviceA(db);
    const payload = buildBackupPayloadFromDatabase(db, "full");

    const deviceB = createTestDatabase();
    try {
      deviceB.prepare(
        `INSERT INTO subscriptions (id, title, billing_model, amount_original, currency_code, created_at, updated_at, interval_count)
         VALUES (1, 'محلي', 'one_time', 10, 'QAR', ?, ?, 1)`,
      ).run(NOW, NOW);

      applyBackupImport(deviceB, payload, {
        strategy: "merge",
        onDuplicateId: "prefer_import",
        onSimilarSubscription: "keep_both",
      });

      const row = deviceB.prepare("SELECT title FROM subscriptions WHERE id = 1").get() as {
        title: string;
      };
      expect(row.title).toBe("Netflix");
    } finally {
      deviceB.close();
    }
  });

  it("merge adds new subscription from file alongside local", () => {
    seedDeviceA(db);
    const payload = buildBackupPayloadFromDatabase(db, "full");
    (payload.subscriptions[0] as Record<string, unknown>).id = 2;
    (payload.subscriptions[0] as Record<string, unknown>).title = "Spotify";
    payload.payment_events = [];

    const deviceB = createTestDatabase();
    try {
      deviceB.prepare(
        `INSERT INTO subscriptions (id, title, billing_model, amount_original, currency_code, created_at, updated_at, interval_count)
         VALUES (1, 'محلي', 'one_time', 10, 'QAR', ?, ?, 1)`,
      ).run(NOW, NOW);

      applyBackupImport(deviceB, payload, {
        strategy: "merge",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });

      expect(countRow(deviceB, "subscriptions")).toBe(2);
    } finally {
      deviceB.close();
    }
  });
});

describe("without_settings scope", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it("replace keeps local settings table", () => {
    seedDeviceA(db);
    const payload = buildBackupPayloadFromDatabase(db, "without_settings");

    const deviceB = createTestDatabase();
    try {
      deviceB.prepare("INSERT INTO settings (key, value) VALUES ('theme', 'dark')").run();

      applyBackupImport(deviceB, payload, {
        strategy: "replace",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });

      expect(countRow(deviceB, "subscriptions")).toBe(1);
      expect(countRow(deviceB, "settings")).toBe(1);
      const theme = deviceB.prepare("SELECT value FROM settings WHERE key = 'theme'").get() as {
        value: string;
      };
      expect(theme.value).toBe("dark");
    } finally {
      deviceB.close();
    }
  });
});

describe("buildImportPreview", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it("reports id conflicts before apply", () => {
    seedDeviceA(db);
    const payload = buildBackupPayloadFromDatabase(db, "full");

    const deviceB = createTestDatabase();
    try {
      deviceB.prepare(
        `INSERT INTO subscriptions (id, title, billing_model, amount_original, currency_code, created_at, updated_at, interval_count)
         VALUES (1, 'محلي', 'one_time', 1, 'QAR', ?, ?, 1)`,
      ).run(NOW, NOW);

      const preview = buildImportPreview(deviceB, "/tmp/backup.json", payload);
      expect(preview.idConflicts.subscriptions).toBe(1);
      expect(preview.counts.file.subscriptions).toBe(1);
      expect(preview.counts.db.subscriptions).toBe(1);
    } finally {
      deviceB.close();
    }
  });
});

describe("export payload shape", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it("includes export metadata", () => {
    seedDeviceA(db);
    const payload = buildBackupPayloadFromDatabase(db, "full");
    expect(payload.exportVersion).toBe(6);
    expect(payload.exportScope).toBe("full");
    expect(payload.appVersion).toBe("3.0.0-test");
    expect((payload.subscriptions[0] as BackupPayload["subscriptions"][0] & { title: string }).title).toBe(
      "Netflix",
    );
  });
});
