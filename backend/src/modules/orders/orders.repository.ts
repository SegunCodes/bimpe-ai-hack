import { one, rows, run } from "../../db/pool";
import { Order, OrderWithCustomer } from "../../types/models";
import { CreateOrderInput } from "./orders.schema";

const WITH_CUSTOMER = `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
  FROM orders o JOIN customers c ON c.id = o.customer_id`;

export const ordersRepository = {
  findAll: () => rows<OrderWithCustomer>(`${WITH_CUSTOMER} ORDER BY o.created_at DESC, o.id DESC`),

  findById: (id: number) => one<Order>("SELECT * FROM orders WHERE id = ?", [id]),

  findByIdWithCustomer: (id: number) => one<OrderWithCustomer>(`${WITH_CUSTOMER} WHERE o.id = ?`, [id]),

  findPending: () => rows<{ id: number; customer_id: number }>("SELECT id, customer_id FROM orders WHERE status = 'pending' ORDER BY id"),

  async insert(input: CreateOrderInput): Promise<number> {
    const result = await run(
      "INSERT INTO orders (customer_id, item, seller, address_on_file, delivery_window) VALUES (?, ?, ?, ?, ?)",
      [input.customer_id, input.item, input.seller, input.address_on_file, input.delivery_window]
    );
    return result.insertId;
  },

  markCalling: async (id: number): Promise<void> => {
    await run("UPDATE orders SET status = 'calling', attempts = attempts + 1 WHERE id = ?", [id]);
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
