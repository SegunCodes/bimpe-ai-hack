import mysql, { Pool, ResultSetHeader } from "mysql2/promise";
import { env } from "../config/env";

export const pool: Pool = env.databaseUrl
  ? mysql.createPool(env.databaseUrl)
  : mysql.createPool({ ...env.db, connectionLimit: 10, waitForConnections: true, queueLimit: 0 });

export async function rows<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const [result] = await pool.execute(sql, values as never[]);
  return result as T[];
}

export async function one<T>(sql: string, values: unknown[] = []): Promise<T | undefined> {
  const result = await rows<T>(sql, values);
  return result[0];
}

export async function run(sql: string, values: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.execute(sql, values as never[]);
  return result as ResultSetHeader;
}
