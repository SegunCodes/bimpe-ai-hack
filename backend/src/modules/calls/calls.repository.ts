import { one, rows, run } from "../../db/pool";
import { Call, CallType } from "../../types/models";

export interface DispatchInfo {
  id: number;
  call_type: CallType;
  customer_id: number;
  order_id: number | null;
  phone: string;
  language: string;
  customer_name: string;
  item: string | null;
  seller: string | null;
  address_on_file: string | null;
  delivery_window: string | null;
}

export const callsRepository = {
  findAll: () => rows<Call>("SELECT * FROM calls ORDER BY created_at DESC, id DESC"),

  findInProgressWithProviderId: () => rows<Call>("SELECT * FROM calls WHERE status = 'in_progress' AND provider_call_id IS NOT NULL AND provider_call_id NOT LIKE 'mock-%'"),

  findById: (id: number) => one<Call>("SELECT * FROM calls WHERE id = ?", [id]),

  findByProviderId: (providerCallId: string) => one<Call>("SELECT * FROM calls WHERE provider_call_id = ?", [providerCallId]),

  findByCustomer: (customerId: number) => rows<Call>("SELECT * FROM calls WHERE customer_id = ? ORDER BY created_at DESC, id DESC", [customerId]),

  findByOrder: (orderId: number) => rows<Call>("SELECT * FROM calls WHERE order_id = ? ORDER BY created_at DESC, id DESC", [orderId]),

  async insert(callType: CallType, customerId: number, orderId: number | null): Promise<number> {
    const result = await run("INSERT INTO calls (call_type, customer_id, order_id, status) VALUES (?, ?, ?, 'queued')", [callType, customerId, orderId]);
    return result.insertId;
  },

  findQueuedForDispatch: (callId: number) => one<DispatchInfo>(`SELECT c.id, c.call_type, c.customer_id, c.order_id,
      cu.phone, cu.language, cu.name AS customer_name, o.item, o.seller,
      o.address_on_file, o.delivery_window
    FROM calls c JOIN customers cu ON cu.id = c.customer_id
    LEFT JOIN orders o ON o.id = c.order_id
    WHERE c.id = ? AND c.status = 'queued'`, [callId]),

  markInProgress: async (id: number, providerCallId: string): Promise<void> => {
    await run("UPDATE calls SET provider_call_id = ?, status = 'in_progress' WHERE id = ?", [providerCallId, id]);
  },

  markFailed: async (id: number): Promise<void> => {
    await run("UPDATE calls SET status = 'failed', outcome = 'failed' WHERE id = ?", [id]);
  },

  /** Returns false if the call was not in progress (already completed: idempotency guard). */
  async complete(id: number, data: {
    status: "completed" | "failed";
    outcome: string;
    extracted: Record<string, unknown> | undefined;
    transcript?: string;
    recordingUrl?: string;
    durationSeconds?: number;
  }): Promise<boolean> {
    const result = await run(`UPDATE calls SET status = ?, outcome = ?, extracted_json = ?, transcript = ?,
      recording_url = ?, duration_seconds = ? WHERE id = ? AND status = 'in_progress'`, [
      data.status,
      data.outcome,
      data.extracted ? JSON.stringify(data.extracted) : null,
      data.transcript ?? null,
      data.recordingUrl ?? null,
      data.durationSeconds ?? null,
      id
    ]);
    return result.affectedRows > 0;
  }
};