import { PoolClient } from "pg";
import { one, run, transaction } from "./pool";
import { seedDemoData } from "./seed";

const ORDER_STATUSES = "'pending','scheduled','calling','confirmed','rescheduled','address_updated','no_answer','failed'";

/** Keeps updated_at current on every UPDATE (Postgres has no ON UPDATE CURRENT_TIMESTAMP). */
const TOUCH_FUNCTION = `CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`;

async function createTables(db: PoolClient): Promise<void> {
  await db.query(TOUCH_FUNCTION);

  await db.query(`CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    language VARCHAR(10) NOT NULL DEFAULT 'en' CHECK (language IN ('en','pcm','yo','ha','ig')),
    best_time_to_call VARCHAR(120) NULL,
    address TEXT NULL,
    landmark VARCHAR(255) NULL,
    consent_to_calls SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','called','verified','no_answer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id),
    item VARCHAR(255) NOT NULL,
    seller VARCHAR(160) NOT NULL,
    address_on_file TEXT NOT NULL,
    cleaned_address TEXT NULL,
    landmark VARCHAR(255) NULL,
    delivery_window VARCHAR(160) NOT NULL,
    delivery_at TIMESTAMPTZ NULL,
    call_at TIMESTAMPTZ NULL,
    call_plan VARCHAR(40) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (${ORDER_STATUSES})),
    reschedule_time VARCHAR(160) NULL,
    outcome_notes TEXT NULL,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS idx_orders_due ON orders (status, call_at)");

  // extracted_json is stored as JSON text, which is what the API contract returns.
  await db.query(`CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    call_type VARCHAR(20) NOT NULL CHECK (call_type IN ('delivery','onboarding')),
    customer_id INT NOT NULL REFERENCES customers(id),
    order_id INT NULL REFERENCES orders(id),
    provider_call_id VARCHAR(160) NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','in_progress','completed','failed')),
    outcome VARCHAR(40) NULL,
    extracted_json TEXT NULL,
    transcript TEXT NULL,
    recording_url TEXT NULL,
    duration_seconds INT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS idx_calls_customer_created ON calls (customer_id, created_at)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_calls_status ON calls (status)");

  // Small key/value store for background state (e.g. which call script BimpeAI already has).
  await db.query(`CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(60) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  for (const table of ["customers", "orders", "calls"]) {
    await db.query(`CREATE OR REPLACE TRIGGER ${table}_updated_at BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);
  }
}

export async function initializeDatabase(): Promise<void> {
  // An advisory lock makes concurrent cold starts wait instead of racing each other.
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(727374)");
    await createTables(db);
  });
  const counted = await one<{ total: string }>("SELECT COUNT(*) AS total FROM customers");
  if (Number(counted?.total ?? 0) === 0 && process.env.SEED_DEMO_DATA !== "false") await seedDemoData();
}

let ready: Promise<void> | null = null;

/** Creates tables once per server instance; every request awaits the same promise. */
export function ensureDatabase(): Promise<void> {
  if (!ready) {
    ready = initializeDatabase().catch((error: unknown) => {
      ready = null; // let the next request try again
      throw error;
    });
  }
  return ready;
}

// Kept for scripts that want to know a query works before serving.
export const pingDatabase = () => run("SELECT 1");
