/**
 * What businesses buy. Priced at about ₦650–700 per answered call, above Tellero's cost of
 * roughly ₦400 per call on BimpeAI (₦200 per minute, about 2 minutes per answered call).
 *
 * A plan lasts 30 days and adds its calls to the business's credit balance. Unused credits
 * carry over while the business keeps a plan. Top-up packs add calls without changing plan
 * and need an active plan.
 */
export const PLANS = {
  starter: { name: "Starter", priceNaira: 20_000, calls: 30 },
  growth: { name: "Growth", priceNaira: 65_000, calls: 100 },
  business: { name: "Business", priceNaira: 180_000, calls: 300 }
} as const;

export const TOP_UPS = {
  topup_10: { name: "10 extra calls", priceNaira: 7_000, calls: 10 },
  topup_30: { name: "30 extra calls", priceNaira: 20_000, calls: 30 }
} as const;

export type PlanId = keyof typeof PLANS;
export type TopUpId = keyof typeof TOP_UPS;
export const PLAN_DAYS = 30;

export const isPlanId = (value: unknown): value is PlanId => typeof value === "string" && value in PLANS;
export const isTopUpId = (value: unknown): value is TopUpId => typeof value === "string" && value in TOP_UPS;
