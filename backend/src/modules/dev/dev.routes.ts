import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { conflict, forbidden } from "../../utils/errors";
import { asyncHandler } from "../../utils/http";
import { simulateMockResult } from "../calls/calls.mock";
import { getCall } from "../calls/calls.service";

const simulationSchema = z.object({
  callId: z.coerce.number().int().positive(),
  outcome: z.enum(["confirmed", "rescheduled", "address_updated", "no_answer", "failed"])
});

export const devRoutes = Router();
devRoutes.post("/simulate-call-result", asyncHandler(async (req, res) => {
  if (!env.mockCalls) throw forbidden("Call simulation is available only when MOCK_CALLS=true");
  const input = simulationSchema.parse(req.body);
  const call = await getCall(input.callId);
  if (call.status !== "in_progress") throw conflict("Call must be in progress to simulate a result");
  await simulateMockResult(call.id, input.outcome);
  res.json(await getCall(call.id));
}));
