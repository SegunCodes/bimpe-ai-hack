import { startCall } from "../../integrations/bimpeClient";
import { appEvents } from "../../events/appEvents";
import { normalizePhone } from "../../utils/phone";
import { ordersRepository } from "../orders/orders.repository";
import { callsRepository } from "./calls.repository";

const GAP_MS = 5000;
let queue: Promise<void> = Promise.resolve();
let lastStartedAt = 0;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls are dialled strictly one at a time, 5 seconds apart, so agent context never mixes. */
export function enqueueCall(callId: number): void {
  queue = queue.then(() => processCall(callId)).catch((error: unknown) => {
    console.error("Call queue error:", error);
  });
}

async function processCall(callId: number): Promise<void> {
  const call = await callsRepository.findQueuedForDispatch(callId);
  if (!call) return;

  const delay = Math.max(0, GAP_MS - (Date.now() - lastStartedAt));
  if (lastStartedAt > 0 && delay > 0) await wait(delay);
  lastStartedAt = Date.now();

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
    // Mock mode fakes a result; real mode polls BimpeAI (see calls.poller.ts).
    appEvents.emit("call.started", call.id);
  } catch (error) {
    console.error(`Could not start call ${call.id}:`, error);
    await callsRepository.markFailed(call.id);
    if (call.order_id !== null) await ordersRepository.markFailed(call.order_id, String(error));
  }
}