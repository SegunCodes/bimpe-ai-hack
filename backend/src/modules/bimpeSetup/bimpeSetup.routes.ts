import { Request, Router } from "express";
import { env } from "../../config/env";
import { forbidden } from "../../utils/errors";
import { asyncHandler } from "../../utils/http";
import { runBimpeSetup, setupFingerprint } from "./bimpeSetup.service";
import { recordSetup, toolsBaseUrl } from "./bimpeSetup.auto";

/** Same secret as the cron tick: "Authorization: Bearer <CRON_SECRET>" or ?key=<CRON_SECRET>. */
function authorised(req: Request): boolean {
  if (!env.tick.cronSecret) return false;
  return req.headers.authorization === `Bearer ${env.tick.cronSecret}` || req.query.key === env.tick.cronSecret;
}

export const bimpeSetupRoutes = Router();

/**
 * Configures the BimpeAI agent(s) for Tellero: call script, business profile, and our tools.
 * Open https://<api>/api/admin/bimpe-setup?key=<CRON_SECRET> in a browser, or POST with the header.
 */
bimpeSetupRoutes.all("/bimpe-setup", asyncHandler(async (req, res) => {
  if (!authorised(req)) throw forbidden("Missing or wrong CRON_SECRET");
  const base = toolsBaseUrl() || `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  try {
    const report = await runBimpeSetup(base);
    await recordSetup(setupFingerprint(base), report.ok, report).catch(() => undefined);
    res.json(report);
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
}));
