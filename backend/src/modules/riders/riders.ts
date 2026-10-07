import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { one, rows, run } from "../../db/pool";
import { Rider } from "../../types/models";
import { fromDbUtc } from "../../utils/dbTime";
import { badRequest, conflict, notFound } from "../../utils/errors";
import { asyncHandler, idParam } from "../../utils/http";
import { normalizePhone } from "../../utils/phone";
import { businessIdOf } from "../auth/auth";
import { businessesRepository } from "../businesses/businesses.repository";
import { logoUrl } from "../onboarding/onboarding.service";

/** How long a rider link keeps working after the delivery time (or after the order was added). */
const LINK_DAYS = 3;

export const ridersRepository = {
  findAll: (businessId: number) =>
    rows<Rider & { open_orders: number }>(
      `SELECT r.*, (SELECT COUNT(*)::int FROM orders o WHERE o.rider_id = r.id
         AND o.status NOT IN ('failed','no_answer') AND (o.delivery_at IS NULL OR o.delivery_at > now() - interval '1 day')) AS open_orders
       FROM riders r WHERE r.business_id = ? ORDER BY r.name, r.id`,
      [businessId]
    ),

  findOwned: (id: number, businessId: number) => one<Rider>("SELECT * FROM riders WHERE id = ? AND business_id = ?", [id, businessId]),

  async insert(businessId: number, name: string, phone: string): Promise<number> {
    if (await one("SELECT 1 FROM riders WHERE business_id = ? AND phone = ?", [businessId, phone])) {
      throw conflict("You already have a rider with that phone number.");
    }
    return (await run("INSERT INTO riders (business_id, name, phone) VALUES (?, ?, ?)", [businessId, name, phone])).insertId;
  },

  /** Orders keep their history; they just stop naming this rider. */
  remove: async (id: number, businessId: number): Promise<boolean> =>
    (await run("DELETE FROM riders WHERE id = ? AND business_id = ?", [id, businessId])).affectedRows === 1
};

// ---------- Rider link: a private page with the delivery details, no sign-in ----------

function linkSignature(orderId: number, riderId: number): string {
  return createHmac("sha256", env.auth.sessionSecret || "tellero-dev").update(`rider:${orderId}:${riderId}`).digest("base64url").slice(0, 22);
}

/** Relative address of the rider page. Changing the order's rider changes the address. */
export function riderLinkPath(orderId: number, riderId: number): string {
  return `/r/${orderId}/${linkSignature(orderId, riderId)}`;
}

interface RiderView {
  id: number;
  rider_id: number | null;
  business_id: number;
  item: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  landmark: string | null;
  delivery_window: string;
  delivery_at: string | null;
  reschedule_time: string | null;
  created_at: Date;
  rider_name: string | null;
  business_name: string;
}

async function riderView(orderId: number, signature: string) {
  const order = await one<RiderView>(
    `SELECT o.id, o.rider_id, o.business_id, o.item, o.status, cu.name AS customer_name, cu.phone AS customer_phone,
       COALESCE(o.cleaned_address, o.address_on_file) AS address, COALESCE(o.landmark, cu.landmark) AS landmark,
       o.delivery_window, o.delivery_at, o.reschedule_time, o.created_at, r.name AS rider_name, b.name AS business_name
     FROM orders o JOIN customers cu ON cu.id = o.customer_id JOIN businesses b ON b.id = o.business_id
     LEFT JOIN riders r ON r.id = o.rider_id
     WHERE o.id = ? AND b.suspended_at IS NULL`,
    [orderId]
  );
  if (!order || order.rider_id === null) return null;
  const expected = Buffer.from(linkSignature(order.id, order.rider_id));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const from = order.delivery_at ? new Date(fromDbUtc(order.delivery_at) as string) : new Date(order.created_at);
  if (Date.now() > from.getTime() + LINK_DAYS * 86_400_000) return null;
  return {
    business: { name: order.business_name, logoUrl: await logoUrl(order.business_id) },
    order: {
      id: order.id,
      item: order.item,
      status: order.status,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      address: order.address,
      landmark: order.landmark,
      deliveryWindow: order.delivery_window,
      deliveryAt: fromDbUtc(order.delivery_at),
      rescheduleTime: order.reschedule_time
    },
    riderName: order.rider_name
  };
}

/** Public: GET /api/public/rider/:orderId/:signature */
export const riderLinkRoutes = Router();
riderLinkRoutes.get("/rider/:orderId/:signature", asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  const view = Number.isInteger(orderId) && orderId > 0 ? await riderView(orderId, String(req.params.signature)) : null;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (!view) throw notFound("Delivery");
  res.json(view);
}));

// ---------- The business's riders and call settings ----------

const riderSchema = z.object({
  name: z.string().trim().min(2, "Enter the rider's name").max(160),
  phone: z.string().trim().min(1, "Enter the rider's phone number")
});

export const ridersRoutes = Router();

ridersRoutes.get("/", asyncHandler(async (req, res) => {
  res.json(await ridersRepository.findAll(businessIdOf(req)));
}));

ridersRoutes.post("/", asyncHandler(async (req, res) => {
  const businessId = businessIdOf(req);
  const input = riderSchema.parse(req.body);
  const id = await ridersRepository.insert(businessId, input.name, normalizePhone(input.phone));
  res.status(201).json(await ridersRepository.findOwned(id, businessId));
}));

ridersRoutes.delete("/:id", asyncHandler(async (req, res) => {
  if (!(await ridersRepository.remove(idParam(req), businessIdOf(req)))) throw notFound("Rider");
  res.json({ ok: true });
}));

const settingsSchema = z.object({
  call_notes: z.string().trim().max(600, "Keep it under 600 characters").nullable().optional(),
  rider_calls: z.boolean().optional()
});

/** GET/PATCH /api/settings/calls: what the AI may say about the business, and rider calls on/off. */
export const callSettingsRoutes = Router();

callSettingsRoutes.get("/calls", asyncHandler(async (req, res) => {
  const business = await businessesRepository.findById(businessIdOf(req));
  if (!business) throw notFound("Business");
  res.json({ callNotes: business.call_notes ?? "", riderCalls: business.rider_calls });
}));

callSettingsRoutes.patch("/calls", asyncHandler(async (req, res) => {
  const businessId = businessIdOf(req);
  const input = settingsSchema.parse(req.body);
  if (input.call_notes === undefined && input.rider_calls === undefined) throw badRequest("Nothing to save");
  await businessesRepository.setCallSettings(businessId, {
    ...(input.call_notes !== undefined ? { callNotes: input.call_notes || null } : {}),
    ...(input.rider_calls !== undefined ? { riderCalls: input.rider_calls } : {})
  });
  const business = await businessesRepository.findById(businessId);
  res.json({ callNotes: business?.call_notes ?? "", riderCalls: business?.rider_calls ?? true });
}));
