import { appEvents } from "../../events/appEvents";
import { env } from "../../config/env";
import { callsRepository } from "./calls.repository";
import { applyCallResult } from "./callResults.service";

const RANDOM_OUTCOMES = ["confirmed", "rescheduled", "address_updated", "no_answer"];

/** Call once at startup. In mock mode, every started call gets a fake result after 6 seconds. */
export function registerMockCalls(): void {
  appEvents.on("call.started", (callId: number) => {
    if (!env.mockCalls) return;
    setTimeout(() => {
      simulateMockResult(callId).catch((error: unknown) => console.error("Mock result failed:", error));
    }, 6000).unref();
  });
}

export async function simulateMockResult(callId: number, requestedOutcome?: string): Promise<void> {
  const call = await callsRepository.findById(callId);
  if (!call || call.status !== "in_progress") return;

  const outcome = requestedOutcome || RANDOM_OUTCOMES[Math.floor(Math.random() * RANDOM_OUTCOMES.length)];
  const extracted = call.call_type === "delivery"
    ? {
        outcome,
        cleaned_address: "12 Admiralty Way, Lekki Phase 1, Lagos",
        landmark: "Opposite the Lekki Conservation Centre gate",
        reschedule_time: outcome === "rescheduled" ? "Tomorrow, 10am-1pm" : null,
        outcome_notes: `Customer response: ${outcome.replaceAll("_", " ")}`
      }
    : {
        outcome,
        address: "12 Admiralty Way, Lekki Phase 1, Lagos",
        landmark: "Opposite the Lekki Conservation Centre gate",
        language: "en",
        best_time_to_call: "Weekdays, 5pm-7pm",
        consent_to_calls: true
      };

  await applyCallResult({
    providerCallId: call.provider_call_id || `local-${call.id}`,
    status: outcome === "failed" ? "failed" : outcome === "no_answer" ? "no_answer" : "completed",
    transcript: `AI: Hello, this is a call about your ${call.call_type === "delivery" ? "delivery" : "account"}.\nCustomer: ${outcome.replaceAll("_", " ")}.\nAI: Thank you.`,
    recordingUrl: `https://example.invalid/recordings/${call.id}.mp3`,
    durationSeconds: 38 + Math.floor(Math.random() * 80),
    extracted
  });
}
