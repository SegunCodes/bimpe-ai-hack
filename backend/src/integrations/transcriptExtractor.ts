import { env } from "../config/env";
import { CustomerCallType as CallType } from "../types/models";

const INSTRUCTIONS: Record<CallType, string> = {
  delivery: `This is a transcript of a delivery-confirmation call. Return a JSON object with exactly these keys:
- outcome: "confirmed" (customer will be available and the address is right), "address_updated" (customer gave a corrected address), "rescheduled" (customer asked for another time), "no_answer" (no customer speech at all, e.g. voicemail), or "failed" (wrong person, refused, hung up, or unclear)
- available: true or false
- cleaned_address: the full final delivery address including landmark, or null
- landmark: string or null
- reschedule_time: string or null
- notes: one short sentence`,
  onboarding: `This is a transcript of a new-customer onboarding call. Return a JSON object with exactly these keys:
- outcome: "verified" (customer completed the details) or "failed" (wrong person, refused, hung up, or unclear)
- address: string or null
- landmark: string or null
- language: one of "en", "pcm", "yo", "ha", "ig", or null
- best_time_to_call: string or null
- consent_to_calls: true or false (false if they declined or never said yes)
- notes: one short sentence`
};

/**
 * Turns a call transcript into structured fields using Claude.
 * Returns {} (and the call gets flagged for review) if no key is set or anything goes wrong.
 */
export async function extractFromTranscript(callType: CallType, transcript: string): Promise<Record<string, unknown>> {
  if (!env.anthropic.apiKey) {
    console.warn("ANTHROPIC_API_KEY is not set: cannot extract call results from the transcript.");
    return {};
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.anthropic.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: env.anthropic.model,
        max_tokens: 600,
        system: `${INSTRUCTIONS[callType]}\n\nRespond with the JSON object only: no explanation, no code fences. Use only what the customer actually said. Never invent details.`,
        messages: [{ role: "user", content: `Transcript:\n\n${transcript}` }]
      })
    });
    if (!response.ok) throw new Error(`Anthropic API ${response.status}: ${await response.text()}`);
    const data = await response.json() as { content?: { type: string; text?: string }[] };
    const text = (data.content || []).map((block) => block.text ?? "").join("");
    const parsed: unknown = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch (error) {
    console.error("Transcript extraction failed:", error);
    return {};
  }
}