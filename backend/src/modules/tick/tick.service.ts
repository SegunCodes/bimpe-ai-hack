import { env } from "../../config/env";
import { run } from "../../db/pool";
import { dispatchQueued } from "../calls/calls.dispatch";
import { settleMockCalls } from "../calls/calls.mock";
import { checkLiveCalls } from "../calls/calls.poller";
import { repairUndeterminedCalls } from "../calls/callResults.service";
import { runSchedulerTick } from "../orders/orders.scheduler";
import { syncAgentIfChanged } from "../bimpeSetup/bimpeSetup.auto";

export interface TickSummary {
  scheduled: number;
  dialled: number;
  mockSettled: number;
  liveFinished: number;
  repaired: number;
  agentScript: string;
  errors: string[];
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
 *   5. send the call script and tools to BimpeAI if they changed since the last deploy
 */
/** Runs one step; a failure is logged and recorded but never stops the steps after it. */
async function step<T>(name: string, errors: string[], fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`Tick step "${name}" failed:`, error);
    errors.push(`${name}: ${(error as Error).message}`.slice(0, 300));
    return fallback;
  }
}

/** Saves the last tick's result for the self-check page (no secrets: counts and error messages). */
async function recordTick(summary: TickSummary): Promise<void> {
  await run(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('last_tick', ?, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() RETURNING key`,
    [JSON.stringify(summary)]
  ).catch((error) => console.error("Could not record the tick:", error));
}

// A tick that hangs (for example a network call that never returns) must not block every
// later tick on this instance forever.
const STALE_TICK_MS = 2 * 60 * 1000;

export function runTick(): Promise<TickSummary> {
  if (running && Date.now() - lastStartedAt < STALE_TICK_MS) return running;
  lastStartedAt = Date.now();
  const current = (async () => {
    const started = Date.now();
    const errors: string[] = [];
    const scheduled = await step("scheduler", errors, 0, runSchedulerTick);
    const dialled = await step("dial queue", errors, 0, () => dispatchQueued(10));
    const mockSettled = await step("demo calls", errors, 0, settleMockCalls);
    const liveFinished = await step("live calls", errors, 0, () => checkLiveCalls());
    const repaired = await step("re-read results", errors, 0, () => repairUndeterminedCalls());
    const agentScript = await step("agent script", errors, "failed", syncAgentIfChanged);
    const summary: TickSummary = { scheduled, dialled, mockSettled, liveFinished, repaired, agentScript, errors, ms: Date.now() - started };
    await recordTick(summary);
    return summary;
  })().finally(() => {
    if (running === current) running = null;
  });
  running = current;
  return current;
}

/** True when enough time has passed that a request may kick off another background tick. */
export function tickIsDue(): boolean {
  return Date.now() - lastStartedAt >= env.tick.minGapMs;
}
