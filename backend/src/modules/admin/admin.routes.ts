import { Router } from "express";
import { z } from "zod";
import { rows } from "../../db/pool";
import { badRequest, notFound } from "../../utils/errors";
import { asyncHandler, idParam } from "../../utils/http";
import { planStatus } from "../businesses/access";
import { businessesRepository } from "../businesses/businesses.repository";
import { PLAN_DAYS, PLANS, isPlanId } from "../businesses/plans";
import { ordersRepository } from "../orders/orders.repository";

/** The platform owner's view across every business. Mounted behind requireAdmin. */
export const adminRoutes = Router();

adminRoutes.get("/overview", asyncHandler(async (_req, res) => {
  const list = await businessesRepository.listForAdmin();
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
      plan: await planStatus(b)
    }))
  );
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
    revenue: { payments: payments.length, totalNaira: payments.reduce((sum, p) => sum + p.amount_kobo / 100, 0) }
  });
}));

/** Switch a plan on (or off) by hand: for demos, bank transfers, or before Paystack is set up. */
adminRoutes.post("/businesses/:id/plan", asyncHandler(async (req, res) => {
  const id = idParam(req);
  const input = z.object({ plan: z.string().nullable(), days: z.coerce.number().int().min(1).max(366).optional() }).parse(req.body);
  if (input.plan !== null && !isPlanId(input.plan)) throw badRequest("Unknown plan");
  const business = await businessesRepository.findById(id);
  if (!business || business.is_house) throw notFound("Business");
  await businessesRepository.setPlan(id, input.plan, input.days ?? PLAN_DAYS);
  const updated = await businessesRepository.findById(id);
  res.json({ id, plan: updated ? await planStatus(updated) : null });
}));
