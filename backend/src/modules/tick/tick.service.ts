import { env } from "../../config/env";
import { dispatchQueued } from "../calls/calls.dispatch";
import { settleMockCalls } from "../calls/calls.mock";
import { checkLiveCalls } from "../calls/calls.poller";
import { repairUndeterminedCalls } from "../calls/callResults.service";
import { runSchedulerTick } from "../orders/orders.scheduler";

export interface TickSummary {
  scheduled: number;
  dialled: number;
  mockSettled: number;
  liveFinished: number;
  repaired: number;
  ms: number;
}

let running: Promise<TickSummary> | null = null;
let lastStartedAt = 0;

/**
 * One pass of all background work. Every step claims rows atomically, so ticks running at the
 * same time (cron + dashboard + another instance) can never double-dial or double-record.
 *   1. start calls for scheduled orders whose time has come (and no-answer retries)
 *   2. dial any calls still waiting in the queue
 *   3. demo mode: give finished fake calls their result; live mode: ask BimpeAI about live calls
 *   4. re-read a few calls whose result could not be worked out earlier
 */
export function runTick(): Promise<TickSummary> {
  if (running) return running;
  lastStartedAt = Date.now();
  running = (async () => {
    const started = Date.now();
    const scheduled = await runSchedulerTick();
    const dialled = await dispatchQueued(10);
    const mockSettled = await settleMockCalls();
    const liveFinished = await checkLiveCalls();
    const repaired = await repairUndeterminedCalls();
    return { scheduled, dialled, mockSettled, liveFinished, repaired, ms: Date.now() - started };
  })().finally(() => {
    running = null;
  });
  return running;
}

/** True when enough time has passed that a request may kick off another background tick. */
export function tickIsDue(): boolean {
  return Date.now() - lastStartedAt >= env.tick.minGapMs;
}
