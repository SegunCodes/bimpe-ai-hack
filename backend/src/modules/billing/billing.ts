import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import express, { Request, Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { one, run } from "../../db/pool";
import { badRequest, HttpError, notFound } from "../../utils/errors";
import { asyncHandler } from "../../utils/http";
import { businessIdOf, publicBusiness, requireBusiness } from "../auth/auth";
import { businessesRepository } from "../businesses/businesses.repository";
import { PLAN_DAYS, PLANS, TOP_UPS, isPlanId, isTopUpId } from "../businesses/plans";
import { grantPlan } from "../businesses/access";

/**
 * Plan payments through Paystack (https://paystack.com/docs/api/transaction):
 *   1. POST /api/billing/checkout {plan}  → we create a pending payment and return Paystack's payment page
 *   2. the business pays and Paystack sends them back to /dashboard/billing?reference=…
 *   3. GET /api/billing/verify?reference=… (and Paystack's webhook) confirm it with Paystack and start the plan
 * A payment can only ever start a plan once, however many times it is confirmed.
 */

// Overridable only so the payment flow can be tested against a stand-in.
const PAYSTACK = (process.env.PAYSTACK_API_BASE || "https://api.paystack.co").replace(/\/+$/, "");

interface PaystackEnvelope<T> { status: boolean; message: string; data: T }

async function paystack<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!env.paystack.secretKey) throw new HttpError(503, "Online payments aren't set up yet. Contact Tellero AI to switch on your plan.");
  const response = await fetch(`${PAYSTACK}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.paystack.secretKey}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<PaystackEnvelope<T>>;
  if (!response.ok || !payload.status) throw new HttpError(502, `Paystack: ${payload.message || `request failed (${response.status})`}`);
  return payload.data as T;
}

interface PaymentRow { id: number; business_id: number; reference: string; plan: string; kind: string; amount_kobo: number; status: string }

/**
 * Starts the plan for a payment Paystack says succeeded. Checks amount and currency against
 * what we asked for, then claims the payment atomically so a plan starts once per payment.
 */
async function confirmPayment(reference: string): Promise<"paid" | "pending" | "failed"> {
  const payment = await one<PaymentRow>("SELECT * FROM payments WHERE reference = ?", [reference]);
  if (!payment) throw notFound("Payment");
  if (payment.status === "paid") return "paid";

  const tx = await paystack<{ status: string; amount: number; currency: string; reference: string }>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.status !== "success") {
    if (["failed", "abandoned", "reversed"].includes(tx.status)) await run("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'", [payment.id]);
    return tx.status === "failed" || tx.status === "reversed" ? "failed" : "pending";
  }
  if (tx.amount !== payment.amount_kobo || tx.currency !== "NGN") {
    console.error(`Payment ${reference}: Paystack amount ${tx.amount} ${tx.currency} does not match ${payment.amount_kobo} NGN`);
    await run("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'", [payment.id]);
    return "failed";
  }
  const claimed = await run("UPDATE payments SET status = 'paid', paid_at = now() WHERE id = ? AND status <> 'paid'", [payment.id]);
  if (claimed.affectedRows === 1) {
    if (payment.kind === "topup" && isTopUpId(payment.plan)) await businessesRepository.addCredits(payment.business_id, TOP_UPS[payment.plan].calls);
    else if (isPlanId(payment.plan)) await grantPlan(payment.business_id, payment.plan);
  }
  return "paid";
}

/** Where Paystack sends the business after paying: APP_URL, or the dashboard address the request came from. */
function returnUrl(req: Request): string {
  const origin = env.appUrl || String(req.headers.origin || "");
  if (!/^https?:\/\/[^\s/]+$/.test(origin)) throw badRequest("Set APP_URL on the server so Paystack knows where to send people back.");
  return `${origin}/dashboard/billing`;
}

export const billingRoutes = Router();
billingRoutes.use(requireBusiness);

billingRoutes.get("/", asyncHandler(async (req, res) => {
  const business = await businessesRepository.findById(businessIdOf(req));
  if (!business) throw notFound("Business");
  res.json({
    business: await publicBusiness(business),
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p, days: PLAN_DAYS })),
    topUps: Object.entries(TOP_UPS).map(([id, p]) => ({ id, ...p })),
    paymentsEnabled: Boolean(env.paystack.secretKey)
  });
}));

billingRoutes.post("/checkout", asyncHandler(async (req, res) => {
  // {plan: "starter"} buys a month; {plan: "topup_10"} buys extra calls (needs an active plan).
  const { plan } = z.object({ plan: z.string() }).parse(req.body);
  const kind = isTopUpId(plan) ? "topup" : "plan";
  if (!isPlanId(plan) && !isTopUpId(plan)) throw badRequest("Unknown plan");
  const business = await businessesRepository.findById(businessIdOf(req));
  if (!business) throw notFound("Business");
  if (isTopUpId(plan) && !(business.plan_expires_at && new Date(business.plan_expires_at).getTime() > Date.now())) {
    throw badRequest("Top-ups add calls to an active plan. Choose a plan first.");
  }
  const amountKobo = (isTopUpId(plan) ? TOP_UPS[plan].priceNaira : PLANS[plan as keyof typeof PLANS].priceNaira) * 100;
  const reference = `tl_${business.id}_${randomBytes(8).toString("hex")}`;
  const callback = `${returnUrl(req)}?reference=${reference}`;
  const tx = await paystack<{ authorization_url: string }>("POST", "/transaction/initialize", {
    email: business.email,
    amount: amountKobo,
    currency: "NGN",
    reference,
    callback_url: callback,
    metadata: { business_id: business.id, plan, kind }
  });
  await run("INSERT INTO payments (business_id, reference, plan, kind, amount_kobo) VALUES (?, ?, ?, ?, ?)", [business.id, reference, plan, kind, amountKobo]);
  res.json({ url: tx.authorization_url, reference });
}));

billingRoutes.get("/verify", asyncHandler(async (req, res) => {
  const reference = z.string().min(1).max(100).parse(req.query.reference);
  const payment = await one<PaymentRow>("SELECT * FROM payments WHERE reference = ? AND business_id = ?", [reference, businessIdOf(req)]);
  if (!payment) throw notFound("Payment");
  const status = await confirmPayment(reference);
  const business = await businessesRepository.findById(businessIdOf(req));
  res.json({ status, business: business ? await publicBusiness(business) : null });
}));

/**
 * Paystack's webhook (set its URL to https://<backend>/api/webhooks/paystack in the Paystack
 * dashboard). Covers people who close the tab before coming back. Signed with the secret key.
 */
export const paystackWebhookRoutes = Router();
paystackWebhookRoutes.post("/", express.raw({ type: "*/*", limit: "1mb" }), asyncHandler(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const expected = createHmac("sha512", env.paystack.secretKey || "missing").update(raw).digest("hex");
  const given = String(req.headers["x-paystack-signature"] || "");
  if (!env.paystack.secretKey || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    res.status(401).json({ error: "Bad signature" });
    return;
  }
  const event = JSON.parse(raw.toString("utf8")) as { event?: string; data?: { reference?: string } };
  if (event.event === "charge.success" && event.data?.reference) {
    // Re-checks with Paystack and only acts on payments we created; unknown references are ignored.
    await confirmPayment(event.data.reference).catch((error) => console.error("Paystack webhook:", error));
  }
  res.json({ ok: true });
}));
