import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { env } from "./config/env";
import { ensureDatabase } from "./db/schema";
import { errorHandler } from "./middleware/errorHandler";
import { runInBackground } from "./utils/background";
import { devRoutes } from "./modules/dev/dev.routes";
import { runTick, tickIsDue } from "./modules/tick/tick.service";
import { tickRoutes } from "./modules/tick/tick.routes";
import { webhooksRoutes } from "./modules/webhooks/webhooks.routes";
import { apiRoutes } from "./routes";
import { systemStatus } from "./modules/status/status";
import { requireAdmin } from "./modules/auth/auth";
import { paystackWebhookRoutes } from "./modules/billing/billing";

export function createApp(): express.Express {
  const app = express();
  app.use(cors());

  const health = (_req: Request, res: Response): void => {
    res.json({ ok: true, mockMode: env.mockCalls });
  };
  app.get(["/health", "/api/health"], health);

  // Public check: just whether the service and its database are up. The detailed version
  // (settings, background job, agent script) is only for the admin: GET /api/admin/status.
  app.get("/", async (_req: Request, res: Response) => {
    const status = await systemStatus();
    res.status(status.ok ? 200 : 503).json({ ok: status.ok });
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
  // Paystack signs the raw body, so this must come before the JSON parser.
  app.use("/api/webhooks/paystack", paystackWebhookRoutes);
  app.use(["/api/webhooks", "/webhooks"], express.raw({ type: "*/*", limit: "1mb" }), webhooksRoutes);

  app.use(express.json({ limit: "1mb" }));

  app.use("/api/cron", tickRoutes);
  app.use("/api", apiRoutes);
  app.use(["/api/dev", "/dev"], requireAdmin, devRoutes);

  app.use(errorHandler);
  return app;
}

/** Vercel deploys this default export as a single serverless function. */
const app = createApp();
export default app;
