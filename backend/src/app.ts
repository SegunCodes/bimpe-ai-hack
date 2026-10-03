import cors from "cors";
import express, { Request, Response } from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { devRoutes } from "./modules/dev/dev.routes";
import { webhooksRoutes } from "./modules/webhooks/webhooks.routes";
import { apiRoutes } from "./routes";

export function createApp(): express.Express {
  const app = express();
  app.use(cors());

  // Webhooks need the raw body, so they are mounted BEFORE express.json().
  app.use(["/api/webhooks", "/webhooks"], express.raw({ type: "*/*", limit: "1mb" }), webhooksRoutes);

  app.use(express.json({ limit: "1mb" }));

  const health = (_req: Request, res: Response): void => {
    res.json({ ok: true, mockMode: env.mockCalls });
  };
  app.get(["/health", "/api/health"], health);

  app.use("/api", apiRoutes);
  app.use(["/api/dev", "/dev"], devRoutes);

  app.use(errorHandler);
  return app;
}
