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
      trial_ends_on TEXT,
      renewal_cancelled INTEGER NOT NULL DEFAULT 0,
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

function tableSnapshot(db: Database.Database, table: string, orderBy: string): unknown[] {
  return db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
}

function seedComprehensive(db: Database.Database): void {
  db.prepare(
    `INSERT INTO categories (id, name, sort_order) VALUES (1, 'Entertainment', 0), (2, 'Cloud', 1)`,
  ).run();
  db.prepare(
    `INSERT INTO currencies (code, sort_order) VALUES ('QAR', 0), ('USD', 1)`,
  ).run();
  db.prepare(
    `INSERT INTO credit_cards (id, brand, last4, exp_month, exp_year, description, created_at, updated_at)
     VALUES (1, 'visa', '4242', 12, 2028, 'Primary card', ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO wallet_methods (id, service_code, account_text, linked_card_id, created_at, updated_at)
     VALUES (1, 'apple_pay', 'user@mail.com', 1, ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO subscriptions (
      id, title, notes, website_url, category_id, billing_model, interval_unit, interval_months,
      interval_count, auto_renew, amount_original, currency_code, amount_qar_snapshot, fx_rate_used,
      fx_quote_at, start_date, next_due_date, end_date, is_domain, tags, credit_card_id,
      wallet_method_id, account_label, cancelled_at, created_at, updated_at
    ) VALUES
    (1, 'Netflix', 'Family plan', 'https://www.netflix.com', 1, 'recurring', 'month', NULL,
     1, 1, 50, 'QAR', 50, 1, '${NOW}', '2025-01-01', '2026-07-01', NULL, 0, NULL, NULL,
     1, 'family@mail.com', NULL, '${NOW}', '${NOW}'),
    (2, 'Tech newsletter', 'Free tier', 'https://newsletter.example.com', 2, 'free_account', NULL, NULL,
     1, 0, 0, 'QAR', NULL, NULL, NULL, '2026-01-15', NULL, NULL, 0, NULL, NULL,
     NULL, 'reader@mail.com', NULL, '${NOW}', '${NOW}'),
    (3, 'Cancelled service', NULL, 'https://old.example.com', NULL, 'recurring', 'year', NULL,
     1, 0, 99, 'USD', NULL, NULL, NULL, '2024-01-01', NULL, NULL, 0, NULL, NULL,
     NULL, NULL, '2026-03-01', '${NOW}', '${NOW}'),
    (4, 'Domain', NULL, 'https://example.org', NULL, 'one_time', 'year', NULL,
     5, 0, 120, 'USD', 438, 3.65, '${NOW}', '2026-02-01', NULL, '2031-02-01', 1, NULL, 1,
     NULL, NULL, NULL, '${NOW}', '${NOW}')`,
  ).run();
  db.prepare(
    `INSERT INTO payment_events (id, subscription_id, paid_at, amount_original, currency, amount_qar, renewal_years, renewal_step_count, note)
     VALUES
     (1, 1, '2026-06-01', 50, 'QAR', 50, NULL, NULL, 'Monthly payment'),
     (2, 4, '2026-02-01', 120, 'USD', 438, 5, 5, '5-year renewal')`,
  ).run();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES
     ('primary_currency', 'QAR'),
     ('reminders_enabled', '1'),
     ('reminder_due_days', '7'),
     ('onboarding_complete', '1'),
     ('app_pin_enabled', '0')`,
  ).run();
}

function seedDeviceA(db: Database.Database): void {
  db.prepare("INSERT INTO categories (id, name, sort_order) VALUES (1, 'Cloud', 0)").run();
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
         VALUES (9, 'Legacy', 'one_time', 1, 'USD', ?, ?, 1)`,
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
         VALUES (1, 'Local-only', 'one_time', 10, 'QAR', ?, ?, 1)`,
      ).run(NOW, NOW);

      applyBackupImport(deviceB, payload, {
        strategy: "merge",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });

      const row = deviceB.prepare("SELECT title FROM subscriptions WHERE id = 1").get() as {
        title: string;
      };
      expect(row.title).toBe("Local-only");
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
         VALUES (1, 'Local-only', 'one_time', 10, 'QAR', ?, ?, 1)`,
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
         VALUES (1, 'Local-only', 'one_time', 10, 'QAR', ?, ?, 1)`,
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
         VALUES (1, 'Local-only', 'one_time', 1, 'QAR', ?, ?, 1)`,
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

describe("comprehensive round-trip (all account types)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it("full replace preserves every table row and field", () => {
    seedComprehensive(db);
    const before = {
      categories: tableSnapshot(db, "categories", "id"),
      currencies: tableSnapshot(db, "currencies", "code"),
      credit_cards: tableSnapshot(db, "credit_cards", "id"),
      wallet_methods: tableSnapshot(db, "wallet_methods", "id"),
      subscriptions: tableSnapshot(db, "subscriptions", "id"),
      payment_events: tableSnapshot(db, "payment_events", "id"),
      settings: tableSnapshot(db, "settings", "key"),
    };

    const payload = buildBackupPayloadFromDatabase(db, "full");
    const restored = createTestDatabase();
    try {
      applyBackupImport(restored, payload, {
        strategy: "replace",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });

      expect(tableSnapshot(restored, "categories", "id")).toEqual(before.categories);
      expect(tableSnapshot(restored, "currencies", "code")).toEqual(before.currencies);
      expect(tableSnapshot(restored, "credit_cards", "id")).toEqual(before.credit_cards);
      expect(tableSnapshot(restored, "wallet_methods", "id")).toEqual(before.wallet_methods);
      expect(tableSnapshot(restored, "subscriptions", "id")).toEqual(before.subscriptions);
      expect(tableSnapshot(restored, "payment_events", "id")).toEqual(before.payment_events);
      expect(tableSnapshot(restored, "settings", "key")).toEqual(before.settings);

      const free = restored
        .prepare("SELECT billing_model, account_label FROM subscriptions WHERE id = 2")
        .get() as { billing_model: string; account_label: string };
      expect(free.billing_model).toBe("free_account");
      expect(free.account_label).toBe("reader@mail.com");

      const cancelled = restored
        .prepare("SELECT cancelled_at FROM subscriptions WHERE id = 3")
        .get() as { cancelled_at: string };
      expect(cancelled.cancelled_at).toBe("2026-03-01");

      const walletLink = restored
        .prepare("SELECT linked_card_id FROM wallet_methods WHERE id = 1")
        .get() as { linked_card_id: number };
      expect(walletLink.linked_card_id).toBe(1);

      const payStep = restored
        .prepare("SELECT renewal_step_count FROM payment_events WHERE id = 2")
        .get() as { renewal_step_count: number };
      expect(payStep.renewal_step_count).toBe(5);
    } finally {
      restored.close();
    }
  });

  it("full replace via JSON parse matches export→import pipeline", () => {
    seedComprehensive(db);
    const json = JSON.stringify(buildBackupPayloadFromDatabase(db, "full"));
    const restored = createTestDatabase();
    try {
      applyBackupImport(restored, parseBackupJson(json), {
        strategy: "replace",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });
      expect(countRow(restored, "subscriptions")).toBe(4);
      expect(countRow(restored, "payment_events")).toBe(2);
      expect(countRow(restored, "settings")).toBe(5);
    } finally {
      restored.close();
    }
  });

  it("normalizes legacy pay_as_needed to one_time on import", () => {
    const legacyPayload: BackupPayload = {
      exportVersion: 5,
      exportScope: "full",
      exportedAt: NOW,
      appVersion: "2.0.0",
      categories: [],
      currencies: [],
      credit_cards: [],
      wallet_methods: [],
      settings: [],
      subscriptions: [
        {
          id: 10,
          title: "Legacy",
          billing_model: "pay_as_needed",
          amount_original: 5,
          currency_code: "QAR",
          interval_count: 1,
          auto_renew: 0,
          is_domain: 0,
          created_at: NOW,
          updated_at: NOW,
        },
      ],
      payment_events: [],
    };
    const restored = createTestDatabase();
    try {
      applyBackupImport(restored, legacyPayload, {
        strategy: "replace",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });
      const row = restored
        .prepare("SELECT billing_model FROM subscriptions WHERE id = 10")
        .get() as { billing_model: string };
      expect(row.billing_model).toBe("one_time");
    } finally {
      restored.close();
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

describe("v13 subscription fields round-trip", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it("preserves tags, trial_ends_on, and renewal_cancelled on full replace", () => {
    db.prepare(
      `INSERT INTO subscriptions (
        id, title, billing_model, amount_original, currency_code, interval_count, auto_renew, is_domain,
        tags, trial_ends_on, renewal_cancelled, created_at, updated_at
      ) VALUES (1, 'Trial SaaS', 'recurring', 29, 'USD', 1, 1, 0, 'work, priority', '2026-08-01', 1, ?, ?)`,
    ).run(NOW, NOW);

    const payload = buildBackupPayloadFromDatabase(db, "full");
    const sub = payload.subscriptions[0] as Record<string, unknown>;
    expect(sub.tags).toBe("work, priority");
    expect(sub.trial_ends_on).toBe("2026-08-01");
    expect(sub.renewal_cancelled).toBe(1);

    const restored = createTestDatabase();
    try {
      applyBackupImport(restored, payload, {
        strategy: "replace",
        onDuplicateId: "keep_local",
        onSimilarSubscription: "keep_both",
      });
      const row = restored
        .prepare(
          "SELECT tags, trial_ends_on, renewal_cancelled FROM subscriptions WHERE id = 1",
        )
        .get() as { tags: string; trial_ends_on: string; renewal_cancelled: number };
      expect(row.tags).toBe("work, priority");
      expect(row.trial_ends_on).toBe("2026-08-01");
      expect(row.renewal_cancelled).toBe(1);
    } finally {
      restored.close();
    }
  });

  it("preserves tags on merge prefer_import", () => {
    db.prepare(
      `INSERT INTO subscriptions (
        id, title, billing_model, amount_original, currency_code, interval_count, auto_renew, is_domain,
        tags, created_at, updated_at
      ) VALUES (1, 'Tagged', 'one_time', 10, 'QAR', 1, 0, 0, 'alpha,beta', ?, ?)`,
    ).run(NOW, NOW);
    const payload = buildBackupPayloadFromDatabase(db, "full");

    const deviceB = createTestDatabase();
    try {
      deviceB.prepare(
        `INSERT INTO subscriptions (
          id, title, billing_model, amount_original, currency_code, interval_count, auto_renew, is_domain,
          tags, created_at, updated_at
        ) VALUES (1, 'Local', 'one_time', 5, 'QAR', 1, 0, 0, NULL, ?, ?)`,
      ).run(NOW, NOW);

      applyBackupImport(deviceB, payload, {
        strategy: "merge",
        onDuplicateId: "prefer_import",
        onSimilarSubscription: "keep_both",
      });

      const row = deviceB
        .prepare("SELECT title, tags FROM subscriptions WHERE id = 1")
        .get() as { title: string; tags: string };
      expect(row.title).toBe("Tagged");
      expect(row.tags).toBe("alpha,beta");
    } finally {
      deviceB.close();
    }
  });
});
