import { Pool, PoolClient } from "pg";
import { env } from "../config/env";

/**
 * Postgres (Neon) connection pool. On Vercel one pool lives per function instance and is
 * reused across requests. Use Neon's *pooled* connection string (host contains "-pooler").
 */
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000
});

/**
 * Repositories are written with MySQL-style "?" placeholders; Postgres wants $1, $2, …
 * Converts every "?" that is not inside a single-quoted string literal.
 */
export function toPgPlaceholders(sql: string): string {
  let out = "";
  let n = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") inString = !inString;
    if (ch === "?" && !inString) {
      out += `$${++n}`;
    } else {
      out += ch;
    }
  }
  return out;
}

type Queryable = Pool | PoolClient;

export async function rows<T>(sql: string, values: unknown[] = [], db: Queryable = pool): Promise<T[]> {
  const result = await db.query(toPgPlaceholders(sql), values);
  return result.rows as T[];
}

export async function one<T>(sql: string, values: unknown[] = [], db: Queryable = pool): Promise<T | undefined> {
  const result = await rows<T>(sql, values, db);
  return result[0];
}

export interface RunResult {
  /** id of the inserted row (INSERTs get "RETURNING id" added automatically) */
  insertId: number;
  affectedRows: number;
}

export async function run(sql: string, values: unknown[] = [], db: Queryable = pool): Promise<RunResult> {
  let text = toPgPlaceholders(sql);
  const isInsert = /^\s*insert\s/i.test(text);
  if (isInsert && !/\breturning\b/i.test(text)) text += " RETURNING id";
  const result = await db.query(text, values);
  return {
    insertId: isInsert && result.rows[0] ? Number(result.rows[0].id) : 0,
    affectedRows: result.rowCount ?? 0
  };
}

/** Runs fn inside a transaction on one connection. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
