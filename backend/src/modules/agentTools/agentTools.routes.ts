import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { forbidden, HttpError, notFound } from "../../utils/errors";
import { asyncHandler } from "../../utils/http";
import { normalizePhone } from "../../utils/phone";
import { callsRepository } from "../calls/calls.repository";
import { agentContextRepository } from "../agentContext/agentContext.repository";
import { callBriefing } from "../agentContext/callBriefing";

/**
 * Tools BimpeAI's agent calls DURING a phone call (registered by /api/admin/bimpe-setup):
 *   GET  /api/agent-tools/context?phone=+234…  → who we are calling and why
 *   POST /api/agent-tools/result                → what the customer said (applied when the call ends)
 * Protected by "Authorization: Bearer <agent tool secret>".
 */
export function requireAgentToolSecret(req: Request, _res: Response, next: NextFunction): void {
  if (!env.agentTools.secret) return next(new HttpError(503, "Agent tools are not configured (set CRON_SECRET)"));
  if ((req.headers.authorization || "") !== `Bearer ${env.agentTools.secret}`) return next(forbidden("Invalid agent tool token"));
  next();
}

function phoneFrom(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try { return normalizePhone(value); } catch { return null; }
}

export const agentToolsRoutes = Router();
agentToolsRoutes.use(requireAgentToolSecret);

agentToolsRoutes.get("/context", asyncHandler(async (req, res) => {
  const phone = phoneFrom(req.query.phone);
  // If the agent could not pass the number (or passed it oddly), fall back to the latest active call.
  const call = (phone && (await callsRepository.findActiveForAgent(phone))) || (await callsRepository.findActiveForAgent(null));
  if (!call) throw notFound("Active call");
  const context = await agentContextRepository.findByCallId(String(call.id));
  if (!context) throw notFound("Active call");
  res.json(callBriefing(call.id, context));
}));

const truthy = z.preprocess((v) => (typeof v === "string" ? /^(yes|true|y|1)$/i.test(v.trim()) : v), z.boolean());
const resultSchema = z.object({
  call_id: z.coerce.number().int().positive().optional(),
  phone: z.string().optional(),
  outcome: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase().replace(/[ -]/g, "_") : v),
    z.enum(["confirmed", "rescheduled", "address_updated", "failed", "verified", "briefed"])
  ),
  cleaned_address: z.string().max(2000).optional(),
  landmark: z.string().max(255).optional(),
  reschedule_time: z.string().max(160).optional(),
  notes: z.string().max(2000).optional(),
  language: z.string().max(40).optional(),
  best_time_to_call: z.string().max(120).optional(),
  consent_to_calls: truthy.optional()
});

agentToolsRoutes.post("/result", asyncHandler(async (req, res) => {
  const input = resultSchema.parse({ ...req.query, ...(req.body || {}) });
  const call =
    (input.call_id && (await callsRepository.findById(input.call_id))) ||
    (await callsRepository.findActiveForAgent(phoneFrom(input.phone))) ||
    (await callsRepository.findActiveForAgent(null));
  if (!call) throw notFound("Active call");
  const { call_id: _id, phone: _phone, notes, ...report } = input;
  await callsRepository.saveAgentReport(call.id, { ...report, ...(notes ? { outcome_notes: notes } : {}) });
  res.json({ ok: true, call_id: call.id, message: "Saved. You can wrap up the call politely." });
}));
