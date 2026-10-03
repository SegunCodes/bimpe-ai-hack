import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { env } from "./config/env";
import { ensureDatabase } from "./db/schema";
import { pool } from "./db/pool";
import { errorHandler } from "./middleware/errorHandler";
import { runInBackground } from "./utils/background";
import { devRoutes } from "./modules/dev/dev.routes";
import { runTick, tickIsDue } from "./modules/tick/tick.service";
import { tickRoutes } from "./modules/tick/tick.routes";
import { webhooksRoutes } from "./modules/webhooks/webhooks.routes";
import { apiRoutes } from "./routes";

export function createApp(): express.Express {
  const app = express();
  app.use(cors());

  const health = (_req: Request, res: Response): void => {
    res.json({ ok: true, mockMode: env.mockCalls });
  };
  app.get(["/health", "/api/health"], health);

  // Deployment check: says whether settings are present and the database answers.
  // Reports error *types* only, never URLs, hosts or passwords.
  app.get("/", async (_req: Request, res: Response) => {
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
    res.json({
      ok: database === "ok",
      service: "tellero-call-api",
      database,
      mockMode: env.mockCalls,
      cronSecretSet: Boolean(env.tick.cronSecret),
      bimpeKeySet: Boolean(env.bimpe.apiKey)
    });
  });

  // Tables are created on the first request an instance serves (cheap no-op afterwards).
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    ensureDatabase().then(() => next(), next);
  });

  // While the dashboard is open it polls every few seconds; use those requests to keep
  // background work moving between cron runs. Runs after the response, never slows it down.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.method === "GET" && req.path.startsWith("/api/") && tickIsDue()) {
      runInBackground(runTick().then(() => undefined));
    }
    next();
  });

  // Webhooks need the raw body, so they are mounted BEFORE express.json().
  app.use(["/api/webhooks", "/webhooks"], express.raw({ type: "*/*", limit: "1mb" }), webhooksRoutes);

  app.use(express.json({ limit: "1mb" }));

  app.use("/api/cron", tickRoutes);
  app.use("/api", apiRoutes);
  app.use(["/api/dev", "/dev"], devRoutes);

  app.use(errorHandler);
  return app;
}

/** Vercel deploys this default export as a single serverless function. */
const app = createApp();
export default app;
