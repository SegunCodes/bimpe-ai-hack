/**
 * Monthly plans. Prices are in naira and are placeholders: set them to cover your BimpeAI
 * call costs. A plan lasts 30 days from payment and includes this many calls.
 */
export const PLANS = {
  starter: { name: "Starter", priceNaira: 15_000, calls: 100 },
  growth: { name: "Growth", priceNaira: 45_000, calls: 400 },
  business: { name: "Business", priceNaira: 120_000, calls: 1_200 }
} as const;

export type PlanId = keyof typeof PLANS;
export const PLAN_DAYS = 30;

export const isPlanId = (value: unknown): value is PlanId => typeof value === "string" && value in PLANS;
