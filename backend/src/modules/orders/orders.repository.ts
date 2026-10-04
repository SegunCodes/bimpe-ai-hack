import { one, rows, run } from "../../db/pool";
import { fromDbUtc, toDbUtc } from "../../utils/dbTime";
import { Order, OrderWithCustomer } from "../../types/models";
import { CreateOrderInput } from "./orders.schema";
import { CAN_CALL_SQL } from "../businesses/access";

const WITH_CUSTOMER = `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
  FROM orders o JOIN customers c ON c.id = o.customer_id`;

/** Scheduling DATETIMEs leave the API as ISO 8601 UTC strings. */
function serialize<T extends Order | undefined>(order: T): T {
  if (!order) return order;
  return { ...order, delivery_at: fromDbUtc(order.delivery_at), call_at: fromDbUtc(order.call_at) };
}

export const ordersRepository = {
  findAll: async (businessId: number) =>
    (await rows<OrderWithCustomer>(`${WITH_CUSTOMER} WHERE o.business_id = ? ORDER BY o.created_at DESC, o.id DESC`, [businessId])).map(serialize),

  findAllForAdmin: async () => (await rows<OrderWithCustomer>(`${WITH_CUSTOMER} ORDER BY o.created_at DESC, o.id DESC`)).map(serialize),

  /** Unscoped: for background work that already knows the order exists. */
  findById: async (id: number) => serialize(await one<Order>("SELECT * FROM orders WHERE id = ?", [id])),

  findOwned: async (id: number, businessId: number) => serialize(await one<Order>("SELECT * FROM orders WHERE id = ? AND business_id = ?", [id, businessId])),

  findByIdWithCustomer: async (id: number, businessId: number) =>
    serialize(await one<OrderWithCustomer>(`${WITH_CUSTOMER} WHERE o.id = ? AND o.business_id = ?`, [id, businessId])),

  findPending: (businessId: number) =>
    rows<{ id: number; customer_id: number }>("SELECT id, customer_id FROM orders WHERE status = 'pending' AND business_id = ? ORDER BY id", [businessId]),

  async insert(businessId: number, input: CreateOrderInput): Promise<number> {
    // An order with a call time waits for the scheduler; one without stays pending for a manual call.
    const callAt = input.call_at ? toDbUtc(new Date(input.call_at)) : null;
    const result = await run(
      `INSERT INTO orders (business_id, customer_id, item, seller, address_on_file, delivery_window, delivery_at, call_at, call_plan, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        businessId,
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

  /**
   * Orders whose scheduled call time has arrived, oldest first, for businesses that can call
   * right now. Orders of a business with no plan or no credits stay scheduled and wait.
   */
  findDue: (limit: number) =>
    rows<{ id: number; customer_id: number }>(
      `SELECT o.id, o.customer_id FROM orders o JOIN businesses b ON b.id = o.business_id
       WHERE o.status = 'scheduled' AND o.call_at IS NOT NULL AND o.call_at <= now() AND ${CAN_CALL_SQL}
       ORDER BY o.call_at, o.id LIMIT ${Math.max(1, Math.floor(limit))}`
    ),

  /** Waiting for credit until the delivery time passed: too late to call, so tell the owner. */
  markMissedForCredit: async (): Promise<number> =>
    (await run(
      `UPDATE orders o SET status = 'failed', call_at = NULL,
         outcome_notes = 'Not called: no plan or call credits before the delivery time. Top up so this doesn''t happen again.'
       FROM businesses b
       WHERE b.id = o.business_id AND o.status = 'scheduled' AND o.call_at IS NOT NULL AND o.call_at <= now()
         AND o.delivery_at IS NOT NULL AND o.delivery_at < now() AND NOT ${CAN_CALL_SQL}`
    )).affectedRows,

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
