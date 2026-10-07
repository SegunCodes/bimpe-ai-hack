import { z } from "zod";

export const createOrderSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  item: z.string().trim().min(1).max(255),
  // Optional: defaults to the business's own name (what the AI says it is calling from).
  seller: z.string().trim().max(160).optional().nullable(),
  address_on_file: z.string().trim().min(1).max(2000),
  delivery_window: z.string().trim().min(1).max(160),
  // Scheduling (optional). Times are ISO 8601, e.g. "2026-10-04T08:00:00.000Z".
  delivery_at: z.string().datetime({ offset: true }).optional().nullable(),
  call_at: z.string().datetime({ offset: true }).optional().nullable(),
  call_plan: z.string().trim().max(40).optional().nullable(),
  rider_id: z.coerce.number().int().positive().optional().nullable()
});

export const setRiderSchema = z.object({ rider_id: z.coerce.number().int().positive().nullable() });

export const bulkOrdersSchema = z.object({ orders: z.array(createOrderSchema).min(1).max(500) });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
