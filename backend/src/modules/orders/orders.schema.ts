import { z } from "zod";

export const createOrderSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  item: z.string().trim().min(1).max(255),
  seller: z.string().trim().min(1).max(160),
  address_on_file: z.string().trim().min(1).max(2000),
  delivery_window: z.string().trim().min(1).max(160),
  // Scheduling (optional). Times are ISO 8601, e.g. "2026-10-04T08:00:00.000Z".
  delivery_at: z.string().datetime({ offset: true }).optional().nullable(),
  call_at: z.string().datetime({ offset: true }).optional().nullable(),
  call_plan: z.string().trim().max(40).optional().nullable()
});

export const bulkOrdersSchema = z.object({ orders: z.array(createOrderSchema).min(1).max(500) });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
