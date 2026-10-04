import { HttpError } from "../../utils/errors";
import { run, rows } from "../../db/pool";
import { budgetAllowsCall } from "../capacity/capacity";
import { PLAN_DAYS, PLANS, isPlanId, type PlanId } from "./plans";
import { Business, businessesRepository } from "./businesses.repository";

export interface PlanStatus {
  plan: string | null;
  planName: string | null;
  active: boolean;
  expiresAt: string | null;
  callsUsed: number;
  callsIncluded: number;
  callsLeft: number;
  /** A business with a plan but no credits: calls wait until it tops up. */
  outOfCredits: boolean;
}

/** Where a business stands: which plan, whether it is still running, and calls left this period. */
export async function planStatus(business: Business): Promise<PlanStatus> {
  const active = Boolean(business.plan && business.plan_expires_at && new Date(business.plan_expires_at).getTime() > Date.now());
  const included = isPlanId(business.plan) ? PLANS[business.plan].calls : 0;
  const used = active && business.plan_started_at ? await businessesRepository.callsUsedSince(business.id, new Date(business.plan_started_at)) : 0;
  const credits = Math.max(0, business.call_credits ?? 0);
  return {
    plan: business.plan,
    planName: isPlanId(business.plan) ? PLANS[business.plan].name : null,
    active,
    expiresAt: business.plan_expires_at ? new Date(business.plan_expires_at).toISOString() : null,
    callsUsed: used,
    callsIncluded: included,
    callsLeft: credits,
    outOfCredits: active && credits === 0
  };
}

/**
 * Before a call is placed: the business needs an active plan and a credit (the website account
 * is exempt), and Tellero's shared BimpeAI minute budget must have room. On success one credit is
 * taken; the caller records it on the call so it can be given back if nobody answers.
 * Returns whether a credit was taken.
 */
export async function reserveCall(businessId: number): Promise<boolean> {
  const business = await businessesRepository.findById(businessId);
  if (!business) throw new HttpError(404, "Business not found");
  if (!(await budgetAllowsCall())) {
    throw new HttpError(503, "Tellero has paused new calls for a short while. Scheduled calls will go out on their own as soon as calling resumes.");
  }
  if (business.is_house) return false;
  const active = Boolean(business.plan && business.plan_expires_at && new Date(business.plan_expires_at).getTime() > Date.now());
  if (!active) throw new HttpError(402, "Choose a plan to start calls. Go to Plan & billing in your dashboard.");
  if (!(await businessesRepository.takeCredit(business.id))) {
    throw new HttpError(402, "You've used all your call credits. Buy a top-up or renew your plan and Tellero will carry on calling.");
  }
  return true;
}

/**
 * Gives a call's credit back (nobody answered, or it never connected). Safe to call more than
 * once: only the first call for a given call row refunds anything.
 */
export async function refundCredit(callId: number): Promise<void> {
  const refunded = await rows<{ business_id: number }>(
    "UPDATE calls SET credit_charged = false WHERE id = ? AND credit_charged RETURNING business_id",
    [callId]
  );
  if (refunded[0]) await run("UPDATE businesses SET call_credits = call_credits + 1 WHERE id = ?", [refunded[0].business_id]);
}

/**
 * Starts a 30-day plan now and adds its calls to the business's credits. Unused credits from
 * before carry over, so renewing early never loses calls the business paid for.
 */
export async function grantPlan(businessId: number, plan: PlanId, days = PLAN_DAYS): Promise<void> {
  await businessesRepository.setPlan(businessId, plan, days);
  await businessesRepository.addCredits(businessId, PLANS[plan].calls);
}

/** SQL condition: this business (alias b) may place calls right now. */
export const CAN_CALL_SQL = "(b.is_house OR (b.plan_expires_at > now() AND b.call_credits > 0))";
