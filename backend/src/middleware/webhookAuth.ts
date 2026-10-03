import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function verifyWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  if (!env.webhookSecret) { next(); return; }
  const supplied = req.get("x-webhook-secret") || req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied !== env.webhookSecret) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }
  next();
}
