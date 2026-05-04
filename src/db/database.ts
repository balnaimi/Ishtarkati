import Database from "@tauri-apps/plugin-sql";
import { runMigrations } from "./migrations";

const DB_URL = "sqlite:ishtarkati.db";

let ready: Promise<Database> | null = null;

async function init(): Promise<Database> {
  const db = await Database.load(DB_URL);
  await runMigrations(db);
  await seedCategoriesIfEmpty(db);
  return db;
}

export function getDb(): Promise<Database> {
  if (!ready) {
    ready = init();
  }
  return ready;
}

async function seedCategoriesIfEmpty(db: Database): Promise<void> {
  const rows = await db.select<{ c: number }[]>(
    "SELECT COUNT(*) as c FROM categories",
  );
  if ((rows[0]?.c ?? 0) > 0) return;
  const seeds: [string, number][] = [
    ["خدمات", 1],
    ["ألعاب", 2],
    ["نطاقات", 3],
    ["أخرى", 4],
  ];
  for (const [name, order] of seeds) {
    await db.execute(
      "INSERT INTO categories (name, sort_order) VALUES ($1, $2)",
      [name, order],
    );
  }
}
