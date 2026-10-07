import { AgentContextRow } from "./agentContext.repository";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", pcm: "Nigerian Pidgin", yo: "Yoruba", ha: "Hausa", ig: "Igbo" };

const firstName = (name: string | null | undefined) => (name || "").trim().split(/\s+/)[0] || "there";

/** "+2348031234567" → "0803 123 4567", the way a rider would dial it. */
function localNumber(phone: string): string {
  const digits = phone.replace(/^\+234/, "0");
  return /^0\d{10}$/.test(digits) ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : phone;
}

/**
 * Everything the agent needs for one call, including the exact first sentence, so every call
 * opens with who is calling, for which business, and why (never "How can I help you?").
 */
export function callBriefing(callId: number, c: AgentContextRow): Record<string, unknown> {
  // The website's own account calls people who asked Tellero AI directly.
  const business = c.is_house ? "Tellero AI" : (c.business_name || c.seller || "the seller").trim();
  const calling = c.is_house ? "calling" : `calling from ${business}`;
  const about = c.call_notes?.trim() ? { about_business: c.call_notes.trim() } : {};
  const common = { call_id: callId, call_type: c.call_type, business_name: business, ...about };

  if (c.call_type === "rider") {
    const when = c.order_status === "rescheduled" && c.reschedule_time ? c.reschedule_time : c.delivery_window;
    return {
      ...common,
      rider_name: c.rider_name,
      opening_line: `Hi ${firstName(c.rider_name)}, I'm Tellero AI, ${calling} with the details of a delivery ${firstName(c.customer_name)} just confirmed. Is now a good time?`,
      customer_name: c.customer_name,
      customer_phone: localNumber(c.customer_phone),
      item: c.item,
      delivery_address: c.address_on_file,
      landmark: c.landmark,
      delivery_time: when,
      what_to_do: "Tell the rider the customer's name, the item, the address with the landmark, the delivery time and the customer's phone number, slowly, one at a time. Repeat anything they ask for. Then use Save call result with this call_id and outcome briefed."
    };
  }

  const preferred_language = LANGUAGE_NAMES[String(c.language)] ?? "English";
  if (c.call_type === "delivery") {
    return {
      ...common,
      customer_name: c.customer_name,
      preferred_language,
      opening_line: `Hi ${firstName(c.customer_name)}, I'm Tellero AI, ${calling} to confirm the delivery of your ${c.item || "order"}. Is now a good time?`,
      item: c.item,
      address_on_file: c.address_on_file,
      delivery_window: c.delivery_window,
      what_to_do: "Confirm they're available in the delivery window, confirm or clean up the address, get a landmark, then use Save call result with this call_id."
    };
  }
  return {
    ...common,
    customer_name: c.customer_name,
    preferred_language,
    opening_line: c.is_house
      ? `Hi ${firstName(c.customer_name)}, I'm Tellero AI. You asked us to call, so I'll quickly set you up for delivery calls. Is now a good time?`
      : `Hi ${firstName(c.customer_name)}, I'm Tellero AI, ${calling} to set you up for delivery calls. It takes about a minute. Is now a good time?`,
    address_on_file: c.address_on_file,
    what_to_do: "Welcome them, collect language, address with landmark, best time to call and consent, then use Save call result with this call_id."
  };
}
