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
  findAll: (businessId: number) => rows<Call & { rider_name: string | null; rider_phone: string | null }>(
    `SELECT c.*, r.name AS rider_name, r.phone AS rider_phone FROM calls c LEFT JOIN riders r ON r.id = c.rider_id
     WHERE c.business_id = ? ORDER BY c.created_at DESC, c.id DESC`, [businessId]),

  /** Unscoped: for background work and the agent's tools. */
  findById: (id: number) => one<Call>("SELECT * FROM calls WHERE id = ?", [id]),

  findOwned: (id: number, businessId: number) => one<Call>("SELECT * FROM calls WHERE id = ? AND business_id = ?", [id, businessId]),

  findByProviderId: (providerCallId: string) => one<Call>("SELECT * FROM calls WHERE provider_call_id = ?", [providerCallId]),

  /** The customer's own calls (rider calls about their orders are left out). */
  findByCustomer: (customerId: number) =>
    rows<Call>("SELECT * FROM calls WHERE customer_id = ? AND call_type <> 'rider' ORDER BY created_at DESC, id DESC", [customerId]),

  findRiderCalls: (orderId: number) =>
    rows<Call & { rider_name: string | null }>(
      `SELECT c.*, r.name AS rider_name FROM calls c LEFT JOIN riders r ON r.id = c.rider_id
       WHERE c.rider_order_id = ? ORDER BY c.created_at DESC, c.id DESC`, [orderId]),

  findByOrder: (orderId: number) => rows<Call>("SELECT * FROM calls WHERE order_id = ? ORDER BY created_at DESC, id DESC", [orderId]),

  async insert(
    businessId: number,
    callType: CallType,
    customerId: number,
    orderId: number | null,
    creditCharged: boolean,
    rider?: { riderId: number; orderId: number }
  ): Promise<number> {
    const result = await run(
      `INSERT INTO calls (business_id, call_type, customer_id, order_id, status, credit_charged, rider_id, rider_order_id)
       VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)`,
      [businessId, callType, customerId, orderId, creditCharged, rider?.riderId ?? null, rider?.orderId ?? null]
    );
    return result.insertId;
  },

  /** For a rider call, phone is the rider's: that is who gets dialled. */
  findDispatchInfo: (callId: number) => one<DispatchInfo>(`SELECT c.id, c.call_type, c.customer_id, c.order_id,
      CASE WHEN c.call_type = 'rider' THEN r.phone ELSE cu.phone END AS phone,
      CASE WHEN c.call_type = 'rider' THEN 'en' ELSE cu.language END AS language,
      cu.name AS customer_name, o.item, o.seller, o.address_on_file, o.delivery_window
    FROM calls c JOIN customers cu ON cu.id = c.customer_id
    LEFT JOIN riders r ON r.id = c.rider_id
    LEFT JOIN orders o ON o.id = COALESCE(c.order_id, c.rider_order_id)
    WHERE c.id = ?`, [callId]),

  /** Oldest calls still waiting to be dialled. */
  findQueuedIds: async (limit: number): Promise<number[]> =>
    (await rows<{ id: number }>(`SELECT id FROM calls WHERE status = 'queued' ORDER BY created_at, id LIMIT ${Math.max(1, Math.floor(limit))}`)).map((r) => r.id),

  /** Atomically takes a queued call so only one request ever dials it. */
  async claimQueued(id: number, maxOnThePhone: number): Promise<boolean> {
    // Only if fewer than maxOnThePhone calls are live, so the shared line never gets overloaded.
    const result = await run(
      `UPDATE calls SET status = 'in_progress' WHERE id = ? AND status = 'queued'
       AND (SELECT COUNT(*) FROM calls WHERE status = 'in_progress') < ?`,
      [id, maxOnThePhone]
    );
    return result.affectedRows === 1;
  },

  /** Demo mode: calls that have been "ringing" long enough to get a fake result. */
  findMockDue: (olderThanSeconds: number, limit: number) =>
    rows<{ id: number }>(
      `SELECT id FROM calls WHERE status = 'in_progress' AND provider_call_id LIKE 'mock-%'
       AND updated_at <= now() - make_interval(secs => ?) ORDER BY id LIMIT ${Math.max(1, Math.floor(limit))}`,
      [olderThanSeconds]
    ),

  /** Live calls to ask BimpeAI about, least recently checked first. */
  findLiveInProgress: (limit: number) =>
    rows<Call>(
      `SELECT * FROM calls WHERE status = 'in_progress' AND provider_call_id IS NOT NULL
       AND provider_call_id NOT LIKE 'mock-%' ORDER BY updated_at LIMIT ${Math.max(1, Math.floor(limit))}`
    ),

  /** Calls claimed but never handed a provider id (the request died mid-dial). */
  findStuckWithoutProvider: (olderThanSeconds: number) =>
    rows<{ id: number; order_id: number | null }>(
      `SELECT id, order_id FROM calls WHERE status = 'in_progress' AND provider_call_id IS NULL
       AND updated_at <= now() - make_interval(secs => ?)`,
      [olderThanSeconds]
    ),

  /** The call the agent is most likely on: the customer's active call, else the most recent active call. */
  findActiveForAgent: (phone: string | null) =>
    one<Call & { phone: string }>(
      `SELECT c.*, CASE WHEN c.call_type = 'rider' THEN r.phone ELSE cu.phone END AS phone
       FROM calls c JOIN customers cu ON cu.id = c.customer_id LEFT JOIN riders r ON r.id = c.rider_id
       WHERE c.status IN ('queued','in_progress') AND c.created_at > now() - interval '30 minutes'
       ${phone ? "AND (CASE WHEN c.call_type = 'rider' THEN r.phone ELSE cu.phone END) = ?" : ""}
       ORDER BY (c.status = 'in_progress') DESC, c.created_at DESC, c.id DESC LIMIT 1`,
      phone ? [phone] : []
    ),

  /** Merges what the agent reported during the call into extracted_json (applied when the call ends). */
  saveAgentReport: async (id: number, report: Record<string, unknown>): Promise<void> => {
    const current = await one<{ extracted_json: string | null }>("SELECT extracted_json FROM calls WHERE id = ?", [id]);
    let merged: Record<string, unknown> = {};
    try { merged = current?.extracted_json ? JSON.parse(current.extracted_json) : {}; } catch { merged = {}; }
    await run("UPDATE calls SET extracted_json = ? WHERE id = ?", [JSON.stringify({ ...merged, ...report, reported_by_agent: true }), id]);
  },

  /** Marks that we just checked this call, so other calls get their turn next tick. */
  touch: async (id: number): Promise<void> => {
    await run("UPDATE calls SET updated_at = now() WHERE id = ?", [id]);
  },

  markInProgress: async (id: number, providerCallId: string): Promise<void> => {
    await run("UPDATE calls SET provider_call_id = ?, status = 'in_progress' WHERE id = ?", [providerCallId, id]);
  },

  markFailed: async (id: number): Promise<void> => {
    await run("UPDATE calls SET status = 'failed', outcome = 'failed' WHERE id = ?", [id]);
  },

  /** Returns false if the call was not in progress (already completed: idempotency guard). */
  /** Calls flagged "result could not be determined" that have not been re-read yet. */
  findUndetermined: (limit: number) =>
    rows<Call>(`SELECT * FROM calls WHERE status = 'failed' AND call_type <> 'rider' AND transcript IS NOT NULL
      AND extracted_json LIKE '%could not be determined%' AND extracted_json NOT LIKE '%"rechecked"%'
      ORDER BY id DESC LIMIT ?`, [limit]),

  rewriteResult: async (id: number, status: "completed" | "failed", outcome: string, extracted: Record<string, unknown>): Promise<void> => {
    await run("UPDATE calls SET status = ?, outcome = ?, extracted_json = ? WHERE id = ?", [status, outcome, JSON.stringify(extracted), id]);
  },

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