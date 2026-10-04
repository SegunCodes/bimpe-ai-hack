import { HttpError } from "../../utils/errors";
import { PLANS, isPlanId } from "./plans";
import { Business, businessesRepository } from "./businesses.repository";

export interface PlanStatus {
  plan: string | null;
  planName: string | null;
  active: boolean;
  expiresAt: string | null;
  callsUsed: number;
  callsIncluded: number;
  callsLeft: number;
}

/** Where a business stands: which plan, whether it is still running, and calls left this period. */
export async function planStatus(business: Business): Promise<PlanStatus> {
  const active = Boolean(business.plan && business.plan_expires_at && new Date(business.plan_expires_at).getTime() > Date.now());
  const included = isPlanId(business.plan) ? PLANS[business.plan].calls : 0;
  const used = active && business.plan_started_at ? await businessesRepository.callsUsedSince(business.id, new Date(business.plan_started_at)) : 0;
  return {
    plan: business.plan,
    planName: isPlanId(business.plan) ? PLANS[business.plan].name : null,
    active,
    expiresAt: business.plan_expires_at ? new Date(business.plan_expires_at).toISOString() : null,
    callsUsed: used,
    callsIncluded: included,
    callsLeft: active ? Math.max(0, included - used) : 0
  };
}

/**
 * Stops a call before it is placed unless the business has an active plan with calls left.
 * The website account (the public "Call me" demo) is exempt.
 */
export async function assertCanCall(businessId: number): Promise<void> {
  const business = await businessesRepository.findById(businessId);
  if (!business) throw new HttpError(404, "Business not found");
  if (business.is_house) return;
  const status = await planStatus(business);
  if (!status.active) throw new HttpError(402, "Choose a plan to start calls. Go to Plan & billing in your dashboard.");
  if (status.callsLeft <= 0) throw new HttpError(402, `You've used all ${status.callsIncluded} calls in your ${status.planName} plan. Upgrade or renew to keep calling.`);
}
