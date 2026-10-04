import { z } from "zod";
import { normalizePhone } from "../../utils/phone";
import { tooManyRequests } from "../../utils/errors";
import { createCall } from "../calls/calls.service";
import { customersRepository } from "../customers/customers.repository";
import { businessesRepository } from "../businesses/businesses.repository";

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().min(1)
});

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const attempts = new Map<string, number[]>();

function checkRateLimit(phone: string): void {
  const now = Date.now();
  const recent = (attempts.get(phone) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) throw tooManyRequests("Rate limit exceeded: maximum 3 signups per phone per hour");
  recent.push(now);
  attempts.set(phone, recent);
}

export async function signup(input: z.infer<typeof signupSchema>): Promise<void> {
  const phone = normalizePhone(input.phone);
  checkRateLimit(phone);

  // The website's "Call me" form and /join belong to Tellero's own account, not a customer business.
  const house = await businessesRepository.house();
  let customer = await customersRepository.findByPhone(phone, house.id);
  if (!customer) {
    const id = await customersRepository.insert(house.id, { name: input.name || "New customer", phone });
    customer = await customersRepository.findById(id);
  }
  if (!customer) throw new Error("Could not create customer");
  await createCall("onboarding", customer.id, null);
}
