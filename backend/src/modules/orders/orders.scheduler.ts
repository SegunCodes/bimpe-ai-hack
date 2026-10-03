import { env } from "../../config/env";
import { createCall } from "../calls/calls.service";
import { ordersRepository } from "./orders.repository";

const BATCH = 20;
let running = false;

/**
 * Every few seconds, start the delivery call for each order whose call_at has passed.
 * Each order is claimed atomically first, so overlapping ticks or a second server
 * instance can never call the same customer twice. Calls still go through the normal
 * one-at-a-time dial queue (createCall → calls.queue).
 */
export async function runSchedulerTick(): Promise<number> {
  if (running) return 0;
  running = true;
  let started = 0;
  try {
    const due = await ordersRepository.findDue(BATCH);
    for (const order of due) {
      if (!(await ordersRepository.claimDue(order.id))) continue;
      try {
        await createCall("delivery", order.customer_id, order.id);
        started++;
      } catch (error) {
        console.error(`Scheduler could not start the call for order ${order.id}:`, error);
        await ordersRepository.markFailed(order.id, `Scheduled call could not start: ${String(error)}`);
      }
    }
    if (started > 0) console.log(`Scheduler started ${started} call(s).`);
  } finally {
    running = false;
  }
  return started;
}

/** Call once at startup. Runs immediately, then every SCHEDULER_INTERVAL_MS. */
export function registerOrderScheduler(): void {
  const tick = () => runSchedulerTick().catch((error: unknown) => console.error("Scheduler tick failed:", error));
  void tick();
  setInterval(tick, env.scheduler.intervalMs).unref();
  console.log(
    `Order scheduler on: checks every ${Math.round(env.scheduler.intervalMs / 1000)}s, ` +
      `retries no-answers after ${env.scheduler.retryDelayMinutes} min, up to ${env.scheduler.maxAttempts} attempts.`
  );
}
