import { Request, Router } from "express";
import { env } from "../../config/env";
import { forbidden } from "../../utils/errors";
import { asyncHandler } from "../../utils/http";
import { runTick } from "./tick.service";

/** Accepts the secret as "Authorization: Bearer <CRON_SECRET>" (Vercel Cron's format) or ?key=<CRON_SECRET>. */
function authorised(req: Request): boolean {
  if (!env.tick.cronSecret) return false;
  const header = req.headers.authorization || "";
  return header === `Bearer ${env.tick.cronSecret}` || req.query.key === env.tick.cronSecret;
}

export const tickRoutes = Router();
tickRoutes.all("/tick", asyncHandler(async (req, res) => {
  if (!authorised(req)) throw forbidden("Missing or wrong CRON_SECRET");
  res.json({ ok: true, ...(await runTick()) });
}));
