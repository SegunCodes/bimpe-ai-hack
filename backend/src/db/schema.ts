import { pool, rows } from "./pool";
import { seedDemoData } from "./seed";

// delivery_at / call_at are stored as UTC wall-clock DATETIMEs (see utils/dbTime.ts).
const ORDER_STATUSES = "'pending','scheduled','calling','confirmed','rescheduled','address_updated','no_answer','failed'";

export async function initializeDatabase(): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    language ENUM('en','pcm','yo','ha','ig') NOT NULL DEFAULT 'en',
    best_time_to_call VARCHAR(120) NULL,
    address TEXT NULL,
    landmark VARCHAR(255) NULL,
    consent_to_calls TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('new','called','verified','no_answer') NOT NULL DEFAULT 'new',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    item VARCHAR(255) NOT NULL,
    seller VARCHAR(160) NOT NULL,
    address_on_file TEXT NOT NULL,
    cleaned_address TEXT NULL,
    landmark VARCHAR(255) NULL,
    delivery_window VARCHAR(160) NOT NULL,
    delivery_at DATETIME NULL,
    call_at DATETIME NULL,
    call_plan VARCHAR(40) NULL,
    status ENUM(${ORDER_STATUSES}) NOT NULL DEFAULT 'pending',
    reschedule_time VARCHAR(160) NULL,
    outcome_notes TEXT NULL,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    INDEX idx_orders_due (status, call_at)
  ) ENGINE=InnoDB`);
  await migrateOrderScheduling();

  await pool.execute(`CREATE TABLE IF NOT EXISTS calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    call_type ENUM('delivery','onboarding') NOT NULL,
    customer_id INT NOT NULL,
    order_id INT NULL,
    provider_call_id VARCHAR(160) NULL UNIQUE,
    status ENUM('queued','in_progress','completed','failed') NOT NULL DEFAULT 'queued',
    outcome VARCHAR(40) NULL,
    extracted_json JSON NULL,
    transcript MEDIUMTEXT NULL,
    recording_url TEXT NULL,
    duration_seconds INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_calls_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_calls_order FOREIGN KEY (order_id) REFERENCES orders(id),
    INDEX idx_calls_customer_created (customer_id, created_at),
    INDEX idx_calls_status (status)
  ) ENGINE=InnoDB`);

  const [{ total }] = await rows<{ total: number }>("SELECT COUNT(*) AS total FROM customers");
  if (Number(total) === 0) await seedDemoData();
}


/**
 * Brings an orders table created before scheduling existed up to date.
 * CREATE TABLE IF NOT EXISTS never alters an existing table, so each change is checked and applied once.
 */
async function migrateOrderScheduling(): Promise<void> {
  const columns = await rows<{ name: string; type: string }>(
    "SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'"
  );
  const has = (name: string) => columns.some((c) => c.name === name);
  if (!has("delivery_at")) await pool.execute("ALTER TABLE orders ADD COLUMN delivery_at DATETIME NULL AFTER delivery_window");
  if (!has("call_at")) await pool.execute("ALTER TABLE orders ADD COLUMN call_at DATETIME NULL AFTER delivery_at");
  if (!has("call_plan")) await pool.execute("ALTER TABLE orders ADD COLUMN call_plan VARCHAR(40) NULL AFTER call_at");

  const status = columns.find((c) => c.name === "status");
  if (status && !status.type.includes("'scheduled'")) {
    await pool.execute(`ALTER TABLE orders MODIFY status ENUM(${ORDER_STATUSES}) NOT NULL DEFAULT 'pending'`);
  }

  const [{ total }] = await rows<{ total: number }>(
    "SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_due'"
  );
  if (Number(total) === 0) await pool.execute("CREATE INDEX idx_orders_due ON orders (status, call_at)");
}
