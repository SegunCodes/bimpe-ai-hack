import { env } from "../../config/env";
import { one, run } from "../../db/pool";

/**
 * Keeps Tellero AI inside what its BimpeAI account can pay for. All businesses share one BimpeAI
 * workspace, so two limits apply to everyone together:
 *   - a monthly minute budget (BimpeAI plan minutes plus what the wallet covers)
 *   - a cap on calls running at the same time
 * When the budget is reached, new calls wait (scheduled orders stay scheduled) until the
 * admin raises the budget after topping up BimpeAI, or the next month starts.
 */

const BUDGET_KEY = "minute_budget";
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** "2026-10": the current calendar month in Lagos. */
export function currentMonth(now = Date.now()): string {
  return new Date(now + LAGOS_OFFSET_MS).toISOString().slice(0, 7);
}

/** Midnight on the 1st of this month, Lagos time. */
export function monthStart(now = Date.now()): Date {
  return new Date(`${currentMonth(now)}-01T00:00:00+01:00`);
}

/**
 * BimpeAI minutes used this month across every business: finished calls rounded up to whole
 * minutes (the safe assumption about how BimpeAI bills), plus a hold for calls still on the phone.
 */
export async function minutesUsedThisMonth(): Promise<{ finished: number; held: number; total: number }> {
  const row = await one<{ finished: string; live: string }>(
    `SELECT COALESCE(SUM(CEIL(COALESCE(duration_seconds, 0) / 60.0)) FILTER (WHERE status IN ('completed','failed')), 0) AS finished,
            COUNT(*) FILTER (WHERE status IN ('queued','in_progress')) AS live
     FROM calls WHERE created_at >= ?`,
    [monthStart()]
  );
  const finished = Number(row?.finished ?? 0);
  const held = Number(row?.live ?? 0) * env.capacity.minutesPerLiveCall;
  return { finished, held, total: finished + held };
}

/** This month's minute budget: what the admin set for this month, else BIMPE_MONTHLY_MINUTES. */
export async function minuteBudget(): Promise<{ minutes: number; setByAdmin: boolean }> {
  const row = await one<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", [BUDGET_KEY]);
  try {
    const saved = row ? (JSON.parse(row.value) as { month: string; minutes: number }) : null;
    if (saved && saved.month === currentMonth() && Number.isFinite(saved.minutes)) return { minutes: saved.minutes, setByAdmin: true };
  } catch {
    // fall through to the default
  }
  return { minutes: env.capacity.monthlyMinutes, setByAdmin: false };
}

export async function setMinuteBudget(minutes: number): Promise<void> {
  await run(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() RETURNING key`,
    [BUDGET_KEY, JSON.stringify({ month: currentMonth(), minutes })]
  );
}

/** True while there are enough minutes left this month for one more call. */
export async function budgetAllowsCall(): Promise<boolean> {
  const [used, budget] = await Promise.all([minutesUsedThisMonth(), minuteBudget()]);
  return used.total + env.capacity.minutesPerLiveCall <= budget.minutes;
}

export async function callsOnThePhone(): Promise<number> {
  const row = await one<{ total: string }>("SELECT COUNT(*) AS total FROM calls WHERE status = 'in_progress'");
  return Number(row?.total ?? 0);
}

/** True when another call may be dialled right now (concurrency cap). */
export async function lineIsFree(): Promise<boolean> {
  return (await callsOnThePhone()) < env.capacity.maxConcurrentCalls;
}
