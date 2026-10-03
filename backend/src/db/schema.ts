import { pool, rows } from "./pool";
import { seedDemoData } from "./seed";

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
    status ENUM('pending','calling','confirmed','rescheduled','address_updated','no_answer','failed') NOT NULL DEFAULT 'pending',
    reschedule_time VARCHAR(160) NULL,
    outcome_notes TEXT NULL,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
  ) ENGINE=InnoDB`);

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
