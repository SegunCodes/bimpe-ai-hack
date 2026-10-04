import { env } from "./config/env";
import app from "./app";
import { pool } from "./db/pool";
import { ensureDatabase } from "./db/schema";
import { runTick } from "./modules/tick/tick.service";

/**
 * Local development (and any always-on host): a normal server plus a background tick every
 * TICK_INTERVAL_MS. On Vercel this file is not used; app.ts is the entry and ticks come from
 * the cron endpoint and dashboard traffic.
 */
async function main(): Promise<void> {
  await ensureDatabase();
  app.listen(env.port, () => console.log(`Tellero AI call API listening on http://localhost:${env.port}`));
  setInterval(() => {
    runTick().catch((error: unknown) => console.error("Tick failed:", error));
  }, env.tick.intervalMs);
  console.log(`Background tick every ${Math.round(env.tick.intervalMs / 1000)}s.`);
}

main().catch(async (error: unknown) => {
  console.error("Could not start the API:", error);
  await pool.end();
  process.exit(1);
});
