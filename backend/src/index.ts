import { env } from "./config/env";
import { createApp } from "./app";
import { pool } from "./db/pool";
import { initializeDatabase } from "./db/schema";
import { registerMockCalls } from "./modules/calls/calls.mock";
import { registerCallPoller } from "./modules/calls/calls.poller";
import { registerOrderScheduler } from "./modules/orders/orders.scheduler";

async function main(): Promise<void> {
  await initializeDatabase();
  registerMockCalls();
  await registerCallPoller();
  registerOrderScheduler();
  const app = createApp();
  app.listen(env.port, () => console.log(`BimpeAI call API listening on http://localhost:${env.port}`));
}

main().catch(async (error: unknown) => {
  console.error("Could not start the API:", error);
  await pool.end();
  process.exit(1);
});