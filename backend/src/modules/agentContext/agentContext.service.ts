import { badRequest, notFound } from "../../utils/errors";
import { normalizePhone } from "../../utils/phone";
import { agentContextRepository } from "./agentContext.repository";

export async function getAgentContext(phone?: string, callId?: string): Promise<unknown> {
  if (!phone && !callId) throw badRequest("Provide phone or call_id");
  const context = callId
    ? await agentContextRepository.findByCallId(callId)
    : await agentContextRepository.findByPhone(normalizePhone(phone as string));
  if (!context) throw notFound("Active call context");
  return context;
}
