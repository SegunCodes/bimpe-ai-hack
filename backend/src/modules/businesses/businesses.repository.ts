import { one, rows, run, transaction } from "../../db/pool";
import { HOUSE_BUSINESS_EMAIL } from "../../db/schema";

export interface Business {
  id: number;
  name: string;
  email: string;
  password_hash: string | null;
  is_house: boolean;
  plan: string | null;
  plan_started_at: Date | null;
  plan_expires_at: Date | null;
  call_credits: number;
  owner_name: string | null;
  password_changed_at: Date | null;
  suspended_at: Date | null;
  suspended_reason: string | null;
  email_verified_at: Date | null;
  verification_status: "none" | "pending" | "approved" | "rejected";
  verification_note: string | null;
  verification_updated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const businessesRepository = {
  findById: (id: number) => one<Business>("SELECT * FROM businesses WHERE id = ?", [id]),

  findByEmail: (email: string) => one<Business>("SELECT * FROM businesses WHERE email = ?", [email.trim().toLowerCase()]),

  async house(): Promise<Business> {
    const found = await one<Business>("SELECT * FROM businesses WHERE email = ?", [HOUSE_BUSINESS_EMAIL]);
    if (!found) throw new Error("The Tellero AI website account is missing");
    return found;
  },

  async insert(name: string, email: string, passwordHash: string, ownerName: string): Promise<number> {
    const result = await run("INSERT INTO businesses (name, email, password_hash, owner_name) VALUES (?, ?, ?, ?)", [
      name,
      email.trim().toLowerCase(),
      passwordHash,
      ownerName
    ]);
    return result.insertId;
  },

  setSuspended: async (id: number, suspended: boolean, reason: string | null): Promise<void> => {
    if (suspended) await run("UPDATE businesses SET suspended_at = now(), suspended_reason = ? WHERE id = ?", [reason, id]);
    else await run("UPDATE businesses SET suspended_at = NULL, suspended_reason = NULL WHERE id = ?", [id]);
  },

  /**
   * Permanently removes a business and everything it owns, in one transaction. Payment records
   * stay (with the payer's name and email) for the accounts; they just lose the link.
   */
  async deleteForever(id: number): Promise<void> {
    await transaction(async (db) => {
      await db.query("UPDATE payments SET business_id = NULL WHERE business_id = $1", [id]);
      await db.query("DELETE FROM calls WHERE business_id = $1", [id]);
      await db.query("DELETE FROM orders WHERE business_id = $1", [id]);
      await db.query("DELETE FROM customers WHERE business_id = $1", [id]);
      await db.query("DELETE FROM business_documents WHERE business_id = $1", [id]);
      await db.query("DELETE FROM email_codes WHERE business_id = $1", [id]);
      await db.query("DELETE FROM password_resets WHERE business_id = $1", [id]);
      await db.query("DELETE FROM businesses WHERE id = $1 AND NOT is_house", [id]);
    });
  },

  setPassword: async (id: number, passwordHash: string): Promise<void> => {
    await run("UPDATE businesses SET password_hash = ?, password_changed_at = now() WHERE id = ?", [passwordHash, id]);
  },

  markEmailVerified: async (id: number): Promise<void> => {
    await run("UPDATE businesses SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = ?", [id]);
  },

  setVerification: async (id: number, status: Business["verification_status"], note: string | null): Promise<void> => {
    await run("UPDATE businesses SET verification_status = ?, verification_note = ?, verification_updated_at = now() WHERE id = ?", [status, note, id]);
  },

  /** Starts (or restarts) a plan now for `days` days. The call allowance resets with it. */
  setPlan: async (id: number, plan: string | null, days: number): Promise<void> => {
    if (plan === null) {
      await run("UPDATE businesses SET plan = NULL, plan_started_at = NULL, plan_expires_at = NULL WHERE id = ?", [id]);
      return;
    }
    await run(
      "UPDATE businesses SET plan = ?, plan_started_at = now(), plan_expires_at = now() + make_interval(days => ?) WHERE id = ?",
      [plan, days, id]
    );
  },

  /** Calls that used a credit since the plan started (answered calls; refunded ones don't count). */
  async callsUsedSince(id: number, since: Date): Promise<number> {
    const result = await one<{ total: string }>(
      "SELECT COUNT(*) AS total FROM calls WHERE business_id = ? AND created_at >= ? AND credit_charged",
      [id, since]
    );
    return Number(result?.total ?? 0);
  },

  addCredits: async (id: number, calls: number): Promise<void> => {
    await run("UPDATE businesses SET call_credits = call_credits + ? WHERE id = ?", [calls, id]);
  },

  /** Takes one credit if there is one. Atomic, so two calls at once can't both spend the last credit. */
  async takeCredit(id: number): Promise<boolean> {
    const result = await run("UPDATE businesses SET call_credits = call_credits - 1 WHERE id = ? AND call_credits > 0", [id]);
    return result.affectedRows === 1;
  },

  /** Every business with its numbers for /admin; "month" figures count calls since `monthStart`. */
  listForAdmin: (monthStart: Date) =>
    rows<Business & { customers: string; orders: string; calls: string; month_minutes: string; month_answered: string; revenue_kobo: string }>(
      `SELECT b.*,
        (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id) AS customers,
        (SELECT COUNT(*) FROM orders o WHERE o.business_id = b.id) AS orders,
        (SELECT COUNT(*) FROM calls l WHERE l.business_id = b.id) AS calls,
        (SELECT COALESCE(SUM(CEIL(COALESCE(l.duration_seconds, 0) / 60.0)), 0) FROM calls l WHERE l.business_id = b.id AND l.created_at >= ?) AS month_minutes,
        (SELECT COUNT(*) FROM calls l WHERE l.business_id = b.id AND l.created_at >= ? AND l.credit_charged) AS month_answered,
        (SELECT COALESCE(SUM(p.amount_kobo), 0) FROM payments p WHERE p.business_id = b.id AND p.status = 'paid') AS revenue_kobo
       FROM businesses b ORDER BY b.is_house, b.created_at DESC`,
      [monthStart, monthStart]
    )
};
