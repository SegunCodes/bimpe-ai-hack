import { createCall } from "../calls/calls.service";
import { ordersRepository } from "./orders.repository";
import { budgetAllowsCall } from "../capacity/capacity";
import { HttpError } from "../../utils/errors";

const BATCH = 20;
let running = false;

/**
 * Every few seconds, start the delivery call for each order whose call_at has passed.
 * Each order is claimed atomically first, so overlapping ticks or a second server
 * instance can never call the same customer twice. createCall dials each one straight away.
 */
export async function runSchedulerTick(): Promise<number> {
  if (running) return 0;
  running = true;
  let started = 0;
  try {
    const missed = await ordersRepository.markMissedForCredit();
    if (missed > 0) console.log(`Scheduler: ${missed} order(s) missed their call window waiting for credit.`);
    // Over this month's BimpeAI minute budget: leave every order scheduled until there is room.
    if (!(await budgetAllowsCall())) return 0;
    const due = await ordersRepository.findDue(BATCH);
    for (const order of due) {
      if (!(await ordersRepository.claimDue(order.id))) continue;
      try {
        await createCall("delivery", order.customer_id, order.id);
        started++;
      } catch (error) {
        // Out of credit or minutes since the batch started: wait and try again, don't fail.
        if (error instanceof HttpError && (error.status === 402 || error.status === 503)) {
          await ordersRepository.scheduleRetry(order.id, new Date(Date.now() + 5 * 60_000), `Waiting: ${error.message}`);
          continue;
        }
        console.error(`Scheduler could not start the call for order ${order.id}:`, error);
        await ordersRepository.markFailed(order.id, `Call didn't go out: ${(error as Error).message}`);
      }
    }
    if (started > 0) console.log(`Scheduler started ${started} call(s).`);
  } finally {
    running = false;
  }
  return started;
}
