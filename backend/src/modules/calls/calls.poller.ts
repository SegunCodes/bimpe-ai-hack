import { env } from "../../config/env";
import { appEvents } from "../../events/appEvents";
import { getCall } from "../../integrations/bimpeClient";
import { applyCallResult } from "./callResults.service";
import { callsRepository } from "./calls.repository";

const POLL_MS = 5000;
const MAX_WAIT_MS = 15 * 60 * 1000;
const polling = new Set<number>();

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Real mode only: asks BimpeAI every 5 seconds until the call has ended, then records the result. */
export function pollCall(callId: number): void {
  if (polling.has(callId)) return;
  polling.add(callId);
  void pollLoop(callId)
    .catch((error: unknown) => console.error(`Polling call ${callId} crashed:`, error))
    .finally(() => polling.delete(callId));
}

async function pollLoop(callId: number): Promise<void> {
  const startedAt = Date.now();
  let providerCallId: string | null = null;

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    await wait(POLL_MS);
    const call = await callsRepository.findById(callId);
    if (!call || call.status !== "in_progress" || !call.provider_call_id) return; // done (e.g. webhook got there first)
    providerCallId = call.provider_call_id;
    try {
      const result = await getCall(call.call_type, call.provider_call_id);
      if (result) {
        await applyCallResult(result);
        return;
      }
    } catch (error) {
      console.error(`Could not fetch call ${callId} from BimpeAI:`, error);
    }
  }

  if (providerCallId) {
    await applyCallResult({
      providerCallId,
      status: "failed",
      extracted: { outcome: "failed", outcome_notes: "Timed out waiting for the call to finish" }
    });
  }
}

/** Call once at startup. Polls every new call, and resumes any call that was in progress before a restart. */
export async function registerCallPoller(): Promise<void> {
  if (env.mockCalls) return;
  appEvents.on("call.started", (callId: number) => pollCall(callId));
  for (const call of await callsRepository.findInProgressWithProviderId()) pollCall(call.id);
}