import { one, rows, run } from "../../db/pool";
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
  created_at: Date;
  updated_at: Date;
}

export const businessesRepository = {
  findById: (id: number) => one<Business>("SELECT * FROM businesses WHERE id = ?", [id]),

  findByEmail: (email: string) => one<Business>("SELECT * FROM businesses WHERE email = ?", [email.trim().toLowerCase()]),

  async house(): Promise<Business> {
    const found = await one<Business>("SELECT * FROM businesses WHERE email = ?", [HOUSE_BUSINESS_EMAIL]);
    if (!found) throw new Error("The Tellero website account is missing");
    return found;
  },

  async insert(name: string, email: string, passwordHash: string): Promise<number> {
    const result = await run("INSERT INTO businesses (name, email, password_hash) VALUES (?, ?, ?)", [name, email.trim().toLowerCase(), passwordHash]);
    return result.insertId;
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

  /** Calls that count against the allowance: every call placed since the plan started, except ones that never dialled. */
  async callsUsedSince(id: number, since: Date): Promise<number> {
    const result = await one<{ total: string }>(
      `SELECT COUNT(*) AS total FROM calls WHERE business_id = ? AND created_at >= ?
       AND NOT (status = 'failed' AND provider_call_id IS NULL)`,
      [id, since]
    );
    return Number(result?.total ?? 0);
  },

  /** Every business except the website account, newest first, with its numbers for /admin. */
  listForAdmin: () =>
    rows<Business & { customers: string; orders: string; calls: string }>(
      `SELECT b.*,
        (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id) AS customers,
        (SELECT COUNT(*) FROM orders o WHERE o.business_id = b.id) AS orders,
        (SELECT COUNT(*) FROM calls l WHERE l.business_id = b.id) AS calls
       FROM businesses b ORDER BY b.is_house, b.created_at DESC`
    )
};
