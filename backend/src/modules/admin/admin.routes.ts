import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { rows } from "../../db/pool";
import { callsOnThePhone, currentMonth, minuteBudget, minutesUsedThisMonth, monthStart, setMinuteBudget } from "../capacity/capacity";
import { badRequest, notFound } from "../../utils/errors";
import { asyncHandler, idParam } from "../../utils/http";
import { grantPlan, planStatus } from "../businesses/access";
import { businessesRepository } from "../businesses/businesses.repository";
import { PLAN_DAYS, PLANS, isPlanId, type PlanId } from "../businesses/plans";
import { ordersRepository } from "../orders/orders.repository";

/** The platform owner's view across every business. Mounted behind requireAdmin. */
export const adminRoutes = Router();

adminRoutes.get("/overview", asyncHandler(async (_req, res) => {
  const list = await businessesRepository.listForAdmin(monthStart());
  const businesses = await Promise.all(
    list.map(async (b) => ({
      id: b.id,
      name: b.name,
      email: b.is_house ? null : b.email,
      is_house: b.is_house,
      created_at: b.created_at,
      customers: Number(b.customers),
      orders: Number(b.orders),
      calls: Number(b.calls),
      plan: await planStatus(b),
      usage: {
        minutesThisMonth: Number(b.month_minutes),
        answeredThisMonth: Number(b.month_answered),
        costThisMonthNaira: Number(b.month_minutes) * env.capacity.costPerMinuteNaira,
        revenueNaira: Number(b.revenue_kobo) / 100
      }
    }))
  );
  const [used, budget, onThePhone] = await Promise.all([minutesUsedThisMonth(), minuteBudget(), callsOnThePhone()]);
  const creditsOutstanding = list.filter((b) => !b.is_house).reduce((sum, b) => sum + Math.max(0, b.call_credits), 0);
  const [calls, orders, customers, payments] = await Promise.all([
    rows("SELECT * FROM calls ORDER BY created_at DESC, id DESC"),
    ordersRepository.findAllForAdmin(),
    rows("SELECT * FROM customers ORDER BY created_at DESC, id DESC"),
    rows<{ amount_kobo: number; paid_at: Date }>("SELECT amount_kobo, paid_at FROM payments WHERE status = 'paid'")
  ]);
  res.json({
    businesses,
    calls,
    orders,
    customers,
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })),
    revenue: { payments: payments.length, totalNaira: payments.reduce((sum, p) => sum + p.amount_kobo / 100, 0) },
    capacity: {
      month: currentMonth(),
      minutesUsed: used.total,
      minutesOnLiveCalls: used.held,
      minuteBudget: budget.minutes,
      budgetSetByAdmin: budget.setByAdmin,
      minutesLeft: Math.max(0, budget.minutes - used.total),
      paused: used.total + env.capacity.minutesPerLiveCall > budget.minutes,
      onThePhone,
      maxConcurrentCalls: env.capacity.maxConcurrentCalls,
      costPerMinuteNaira: env.capacity.costPerMinuteNaira,
      creditsOutstanding,
      // Unused credits will need about this many BimpeAI minutes when businesses use them.
      minutesNeededForCredits: creditsOutstanding * env.capacity.minutesPerLiveCall
    }
  });
}));

/** After topping up BimpeAI: set how many BimpeAI minutes Tellero may use this month. */
adminRoutes.post("/capacity", asyncHandler(async (req, res) => {
  const { minutes } = z.object({ minutes: z.coerce.number().int().min(0).max(1_000_000) }).parse(req.body);
  await setMinuteBudget(minutes);
  res.json({ ok: true, minuteBudget: minutes });
}));

/** Switch a plan on (or off) by hand: for demos, bank transfers, or before Paystack is set up. */
adminRoutes.post("/businesses/:id/plan", asyncHandler(async (req, res) => {
  const id = idParam(req);
  const input = z.object({ plan: z.string().nullable(), days: z.coerce.number().int().min(1).max(366).optional() }).parse(req.body);
  if (input.plan !== null && !isPlanId(input.plan)) throw badRequest("Unknown plan");
  const business = await businessesRepository.findById(id);
  if (!business || business.is_house) throw notFound("Business");
  if (input.plan === null) await businessesRepository.setPlan(id, null, 0);
  else await grantPlan(id, input.plan as PlanId, input.days ?? PLAN_DAYS);
  const updated = await businessesRepository.findById(id);
  res.json({ id, plan: updated ? await planStatus(updated) : null });
}));
