import { one, rows, run } from "../../db/pool";
import { Customer } from "../../types/models";

const LANGUAGE_CODES: Record<string, string> = {
  en: "en", english: "en",
  pcm: "pcm", pidgin: "pcm", "nigerian pidgin": "pcm", "pidgin english": "pcm",
  yo: "yo", yoruba: "yo", "yorùbá": "yo",
  ha: "ha", hausa: "ha",
  ig: "ig", igbo: "ig"
};
const languageCode = (value: unknown): string | null =>
  typeof value === "string" ? LANGUAGE_CODES[value.trim().toLowerCase()] ?? null : null;
const consentValue = (value: unknown): number | null => {
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "string" && /^(yes|true|y|1)$/i.test(value.trim())) return 1;
  if (typeof value === "string" && /^(no|false|n|0)$/i.test(value.trim())) return 0;
  return null;
};

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
      languageCode(data.language),
      data.best_time_to_call ?? null,
      consentValue(data.consent_to_calls),
      customerId
    ]);
  },

  setStatus: async (customerId: number, status: "called" | "no_answer"): Promise<void> => {
    await run("UPDATE customers SET status = ? WHERE id = ?", [status, customerId]);
  }
};
