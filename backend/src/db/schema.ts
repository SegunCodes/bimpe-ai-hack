import { PoolClient } from "pg";
import { run, transaction } from "./pool";

const ORDER_STATUSES = "'pending','scheduled','calling','confirmed','rescheduled','address_updated','no_answer','failed'";

/** Keeps updated_at current on every UPDATE (Postgres has no ON UPDATE CURRENT_TIMESTAMP). */
const TOUCH_FUNCTION = `CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`;

/** The built-in account behind the website's "Call me" form and the public /join page. */
export const HOUSE_BUSINESS_EMAIL = "website@tellero.internal";

async function createTables(db: PoolClient): Promise<void> {
  await db.query(TOUCH_FUNCTION);

  // Multi-business upgrade: data from before businesses existed is deleted (decided by the
  // owner), because every customer, order and call must now belong to a business.
  const hasBusinessColumn = await db.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'business_id'"
  );
  const hasCustomers = await db.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'customers'");
  if (hasCustomers.rowCount && !hasBusinessColumn.rowCount) {
    await db.query("DROP TABLE IF EXISTS calls, orders, customers CASCADE");
  }

  await db.query(`CREATE TABLE IF NOT EXISTS businesses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NULL,
    is_house BOOLEAN NOT NULL DEFAULT false,
    plan VARCHAR(40) NULL,
    plan_started_at TIMESTAMPTZ NULL,
    plan_expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await db.query(`INSERT INTO businesses (name, email, is_house) VALUES ('Tellero website', $1, true)
    ON CONFLICT (email) DO NOTHING`, [HOUSE_BUSINESS_EMAIL]);

  await db.query(`CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id),
    reference VARCHAR(100) NOT NULL UNIQUE,
    plan VARCHAR(40) NOT NULL,
    amount_kobo INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ NULL
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id),
    name VARCHAR(160) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en' CHECK (language IN ('en','pcm','yo','ha','ig')),
    best_time_to_call VARCHAR(120) NULL,
    address TEXT NULL,
    landmark VARCHAR(255) NULL,
    consent_to_calls SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','called','verified','no_answer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id, phone)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id),
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
    business_id INT NOT NULL REFERENCES businesses(id),
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

  await db.query("CREATE INDEX IF NOT EXISTS idx_customers_business ON customers (business_id)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_orders_business ON orders (business_id, created_at)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_calls_business ON calls (business_id, created_at)");

  for (const table of ["businesses", "customers", "orders", "calls"]) {
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
