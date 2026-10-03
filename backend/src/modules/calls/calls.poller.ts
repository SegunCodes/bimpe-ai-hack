import { env } from "../../config/env";
import { getCall } from "../../integrations/bimpeClient";
import { ordersRepository } from "../orders/orders.repository";
import { applyCallResult } from "./callResults.service";
import { callsRepository } from "./calls.repository";

const MAX_WAIT_MS = 15 * 60 * 1000;
const STUCK_AFTER_SECONDS = 120;

/**
 * Live mode: asks BimpeAI about calls that are still in progress and records any that have ended.
 * Runs once per tick (it used to be a 5-second loop per call, which cannot run on serverless).
 */
export async function checkLiveCalls(limit = 10): Promise<number> {
  // A request that died between claiming and dialling leaves a call with no provider id.
  for (const stuck of await callsRepository.findStuckWithoutProvider(STUCK_AFTER_SECONDS)) {
    await callsRepository.markFailed(stuck.id);
    if (stuck.order_id !== null) await ordersRepository.markFailed(stuck.order_id, "The call could not be placed. Try again.");
  }
  if (env.mockCalls) return 0;

  let finished = 0;
  for (const call of await callsRepository.findLiveInProgress(limit)) {
    const providerCallId = call.provider_call_id as string;
    try {
      const result = await getCall(call.call_type, providerCallId);
      if (result) {
        await applyCallResult(result);
        finished++;
        continue;
      }
    } catch (error) {
      console.error(`Could not fetch call ${call.id} from BimpeAI:`, error);
    }
    if (Date.now() - new Date(call.created_at).getTime() > MAX_WAIT_MS) {
      await applyCallResult({
        providerCallId,
        status: "failed",
        extracted: { outcome: "failed", outcome_notes: "Timed out waiting for the call to finish" }
      });
      finished++;
    } else {
      await callsRepository.touch(call.id);
    }
  }
  return finished;
}
