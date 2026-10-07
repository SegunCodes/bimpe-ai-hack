import { env } from "../../config/env";
import { callsRepository } from "./calls.repository";
import { applyCallResult } from "./callResults.service";

const RANDOM_OUTCOMES = ["confirmed", "rescheduled", "address_updated", "no_answer"];

export const MOCK_RESULT_AFTER_SECONDS = 6;

/** Demo mode: every call that has been "ringing" for 6 seconds gets a fake result. Run by the tick. */
export async function settleMockCalls(limit = 20): Promise<number> {
  if (!env.mockCalls) return 0;
  const due = await callsRepository.findMockDue(MOCK_RESULT_AFTER_SECONDS, limit);
  for (const call of due) {
    await simulateMockResult(call.id).catch((error: unknown) => console.error("Mock result failed:", error));
  }
  return due.length;
}

export async function simulateMockResult(callId: number, requestedOutcome?: string): Promise<void> {
  const call = await callsRepository.findById(callId);
  if (!call || call.status !== "in_progress") return;

  const choices = call.call_type === "rider" ? ["briefed", "briefed", "no_answer"] : RANDOM_OUTCOMES;
  const outcome = requestedOutcome || choices[Math.floor(Math.random() * choices.length)];
  const extracted = call.call_type === "rider"
    ? { outcome }
    : call.call_type === "delivery"
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
