import { one, rows, run } from "../../db/pool";
import { Customer } from "../../types/models";

export const customersRepository = {
  findAll: () => rows<Customer>("SELECT * FROM customers ORDER BY created_at DESC, id DESC"),

  findById: (id: number) => one<Customer>("SELECT * FROM customers WHERE id = ?", [id]),

  findByPhone: (phone: string) => one<Customer>("SELECT * FROM customers WHERE phone = ?", [phone]),

  async insert(data: { name: string; phone: string; language?: string; address?: string; landmark?: string }): Promise<number> {
    const result = await run(
      "INSERT INTO customers (name, phone, language, address, landmark) VALUES (?, ?, ?, ?, ?)",
      [data.name, data.phone, data.language || "en", data.address || null, data.landmark || null]
    );
    return result.insertId;
  },

  async applyOnboarding(customerId: number, data: Record<string, unknown>): Promise<void> {
    await run(`UPDATE customers SET address = COALESCE(?, address), landmark = COALESCE(?, landmark),
      language = COALESCE(?, language), best_time_to_call = COALESCE(?, best_time_to_call),
      consent_to_calls = COALESCE(?, consent_to_calls), status = 'verified' WHERE id = ?`, [
      data.address ?? data.cleaned_address ?? null,
      data.landmark ?? null,
      data.language ?? null,
      data.best_time_to_call ?? null,
      typeof data.consent_to_calls === "boolean" ? Number(data.consent_to_calls) : null,
      customerId
    ]);
  },

  setStatus: async (customerId: number, status: "called" | "no_answer"): Promise<void> => {
    await run("UPDATE customers SET status = ? WHERE id = ?", [status, customerId]);
  }
};
