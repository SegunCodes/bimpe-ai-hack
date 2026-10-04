import { startCall } from "../../integrations/bimpeClient";
import { env } from "../../config/env";
import { normalizePhone } from "../../utils/phone";
import { refundCredit } from "../businesses/access";
import { ordersRepository } from "../orders/orders.repository";
import { callsRepository } from "./calls.repository";

/**
 * Dials one queued call. Safe to call from anywhere, any number of times:
 * the call is claimed atomically first, so only one request ever dials it.
 * Replaces the old in-memory queue, which cannot survive on serverless hosting.
 */
export async function dispatchCall(callId: number): Promise<boolean> {
  // Stays queued if the line is busy (too many calls at once); a later tick dials it.
  if (!(await callsRepository.claimQueued(callId, env.capacity.maxConcurrentCalls))) return false;
  const call = await callsRepository.findDispatchInfo(callId);
  if (!call) return false;

  try {
    const { providerCallId } = await startCall({
      callType: call.call_type,
      phone: normalizePhone(call.phone),
      language: call.language,
      variables: {
        customer_name: call.customer_name,
        item: call.item,
        seller: call.seller,
        address_on_file: call.address_on_file,
        delivery_window: call.delivery_window
      },
      metadata: { callId: call.id, customerId: call.customer_id, orderId: call.order_id }
    });
    await callsRepository.markInProgress(call.id, providerCallId);
    return true;
  } catch (error) {
    console.error(`Could not start call ${call.id}:`, error);
    await callsRepository.markFailed(call.id);
    await refundCredit(call.id);
    if (call.order_id !== null) await ordersRepository.markFailed(call.order_id, String(error));
    return false;
  }
}

/** Dials up to `limit` waiting calls, oldest first, one after another. */
export async function dispatchQueued(limit: number): Promise<number> {
  let dialled = 0;
  for (const id of await callsRepository.findQueuedIds(limit)) {
    if (await dispatchCall(id)) dialled++;
    else break; // line busy: the rest keep their place in the queue
  }
  return dialled;
}
