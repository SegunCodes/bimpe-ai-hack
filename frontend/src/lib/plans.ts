/**
 * Prices shown on the public website. Keep in step with backend/src/modules/businesses/plans.ts,
 * which is what checkout actually charges.
 */
export const PUBLIC_PLANS = [
  { id: 'starter', name: 'Starter', priceNaira: 20_000, calls: 30, for: 'For a small shop trying it out' },
  { id: 'growth', name: 'Growth', priceNaira: 65_000, calls: 100, for: 'For sellers dispatching most days' },
  { id: 'business', name: 'Business', priceNaira: 180_000, calls: 300, for: 'For busy stores and logistics teams' },
] as const

export const PUBLIC_TOP_UPS = [
  { id: 'topup_10', calls: 10, priceNaira: 7_000 },
  { id: 'topup_30', calls: 30, priceNaira: 20_000 },
] as const

export const PLAN_DAYS = 30
export const SUPPORT_EMAIL = 'support@usetellero.com'

export const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`
