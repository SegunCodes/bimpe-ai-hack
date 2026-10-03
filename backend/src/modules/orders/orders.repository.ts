import { one, rows, run } from "../../db/pool";
import { fromDbUtc, toDbUtc } from "../../utils/dbTime";
import { Order, OrderWithCustomer } from "../../types/models";
import { CreateOrderInput } from "./orders.schema";

const WITH_CUSTOMER = `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
  FROM orders o JOIN customers c ON c.id = o.customer_id`;

/** Scheduling DATETIMEs leave the API as ISO 8601 UTC strings. */
function serialize<T extends Order | undefined>(order: T): T {
  if (!order) return order;
  return { ...order, delivery_at: fromDbUtc(order.delivery_at), call_at: fromDbUtc(order.call_at) };
}

export const ordersRepository = {
  findAll: async () => (await rows<OrderWithCustomer>(`${WITH_CUSTOMER} ORDER BY o.created_at DESC, o.id DESC`)).map(serialize),

  findById: async (id: number) => serialize(await one<Order>("SELECT * FROM orders WHERE id = ?", [id])),

  findByIdWithCustomer: async (id: number) => serialize(await one<OrderWithCustomer>(`${WITH_CUSTOMER} WHERE o.id = ?`, [id])),

  findPending: () => rows<{ id: number; customer_id: number }>("SELECT id, customer_id FROM orders WHERE status = 'pending' ORDER BY id"),

  async insert(input: CreateOrderInput): Promise<number> {
    // An order with a call time waits for the scheduler; one without stays pending for a manual call.
    const callAt = input.call_at ? toDbUtc(new Date(input.call_at)) : null;
    const result = await run(
      `INSERT INTO orders (customer_id, item, seller, address_on_file, delivery_window, delivery_at, call_at, call_plan, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.customer_id,
        input.item,
        input.seller,
        input.address_on_file,
        input.delivery_window,
        input.delivery_at ? toDbUtc(new Date(input.delivery_at)) : null,
        callAt,
        input.call_plan ?? null,
        callAt ? "scheduled" : "pending"
      ]
    );
    return result.insertId;
  },

  /** Clears call_at so a manual "Call now" also cancels any pending scheduled call. */
  markCalling: async (id: number): Promise<void> => {
    await run("UPDATE orders SET status = 'calling', attempts = attempts + 1, call_at = NULL WHERE id = ?", [id]);
  },

  /** Orders whose scheduled call time has arrived, oldest first. */
  findDue: (limit: number) =>
    rows<{ id: number; customer_id: number }>(
      `SELECT id, customer_id FROM orders
       WHERE status = 'scheduled' AND call_at IS NOT NULL AND call_at <= now()
       ORDER BY call_at, id LIMIT ${Math.max(1, Math.floor(limit))}`
    ),

  /** Atomically takes a due order so it can only ever be dialled once. */
  async claimDue(id: number): Promise<boolean> {
    const result = await run(
      "UPDATE orders SET call_at = NULL WHERE id = ? AND status = 'scheduled' AND call_at IS NOT NULL AND call_at <= now()",
      [id]
    );
    return result.affectedRows === 1;
  },

  /** No answer: wait, then let the scheduler call again. */
  scheduleRetry: async (id: number, callAt: Date, notes: string): Promise<void> => {
    await run("UPDATE orders SET status = 'scheduled', call_at = ?, outcome_notes = ? WHERE id = ?", [toDbUtc(callAt), notes, id]);
  },

  markFailed: async (id: number, notes?: string): Promise<void> => {
    if (notes === undefined) await run("UPDATE orders SET status = 'failed' WHERE id = ?", [id]);
    else await run("UPDATE orders SET status = 'failed', outcome_notes = ? WHERE id = ?", [notes, id]);
  },

  async getAttempts(id: number): Promise<number> {
    const order = await one<{ attempts: number }>("SELECT attempts FROM orders WHERE id = ?", [id]);
    return order ? order.attempts : 0;
  },

  async applyDeliveryResult(id: number, status: string, data: Record<string, unknown>): Promise<void> {
    await run(`UPDATE orders SET status = ?, cleaned_address = ?, landmark = ?, reschedule_time = ?, outcome_notes = ? WHERE id = ?`, [
      status,
      data.cleaned_address ?? data.address ?? null,
      data.landmark ?? null,
      data.reschedule_time ?? null,
      data.outcome_notes ?? data.notes ?? null,
      id
    ]);
  }
};
