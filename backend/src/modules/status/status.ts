import { databaseSettingNames, env } from "../../config/env";
import { one, pool } from "../../db/pool";
import { ensureDatabase } from "../../db/schema";
import { agentSetupStatus } from "../bimpeSetup/bimpeSetup.auto";

/** When the background job last ran and whether every step worked (counts and error messages only). */
async function lastTick(): Promise<unknown> {
  const row = await one<{ value: string; updated_at: Date }>("SELECT value, updated_at FROM app_settings WHERE key = 'last_tick'");
  if (!row) return null;
  const summary = JSON.parse(row.value) as { errors?: string[] };
  return { at: row.updated_at, ok: !summary.errors?.length, ...summary };
}

/**
 * Health of the whole service for the admin page: database, which settings are present
 * (names only, never values), the background job and the agent script. Error *types* only,
 * never URLs, hosts or passwords.
 */
export async function systemStatus() {
  let database = "not configured (set DATABASE_URL)";
  if (env.databaseUrl) {
    try {
      await pool.query("SELECT 1");
      await ensureDatabase();
      database = "ok";
    } catch (error) {
      const code = (error as { code?: string }).code || "";
      const reasons: Record<string, string> = {
        ENOTFOUND: "host not found (check the connection string)",
        ECONNREFUSED: "connection refused (check the connection string)",
        ETIMEDOUT: "timed out reaching the database",
        "28P01": "wrong username or password",
        "3D000": "database name does not exist",
        "28000": "access denied"
      };
      database = `error: ${reasons[code] || code || (error as Error).message.slice(0, 120)}`;
    }
  }
  const ready = database === "ok";
  return {
    ok: ready,
    database,
    databaseSettingsFound: databaseSettingNames(),
    mockMode: env.mockCalls,
    settings: {
      cronSecret: Boolean(env.tick.cronSecret),
      callProviderKey: Boolean(env.bimpe.apiKey),
      adminPassword: Boolean(env.admin.password),
      payments: Boolean(env.paystack.secretKey),
      email: Boolean(env.email.resendApiKey)
    },
    agentScript: ready ? await agentSetupStatus().catch(() => ({ status: "unknown" })) : { status: "waiting for the database" },
    lastBackgroundRun: ready ? await lastTick().catch(() => null) : null
  };
}
