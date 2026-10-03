import { extractFromTranscript } from "../../integrations/transcriptExtractor";
import { env } from "../../config/env";
import { CallResult } from "../../types/models";
import { callsRepository } from "./calls.repository";
import { customersRepository } from "../customers/customers.repository";
import { ordersRepository } from "../orders/orders.repository";


function storedReport(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** Returns null when the outcome cannot be determined. */
export function outcomeFrom(extracted: Record<string, unknown> | undefined, status: string): string | null {
  const value = extracted?.outcome ?? extracted?.status ?? status;
  const normalized = String(value).toLowerCase().replace(/[ -]/g, "_");
  if (["busy", "voicemail", "no_answer", "unanswered"].includes(normalized)) return "no_answer";
  if (["confirmed", "rescheduled", "address_updated", "failed", "verified"].includes(normalized)) return normalized;
  return status.toLowerCase().includes("fail") ? "failed" : null;
}

/**
 * Single entry point for a finished call. Used by the webhook, the mock simulator
 * and the poller. Safe to call twice for the same call: the second time does nothing.
 */
export async function applyCallResult(result: CallResult): Promise<void> {
  const call = await callsRepository.findByProviderId(result.providerCallId);
  if (!call || call.status === "completed" || call.status === "failed") return;

  // Prefer, in order: what the provider sent, what the agent reported mid-call via our
  // "Save call result" tool, then a best-effort read of the transcript.
  let extracted = result.extracted ?? storedReport(call.extracted_json);
  if (!extracted && result.transcript) extracted = await extractFromTranscript(call.call_type, result.transcript);
  let outcome = outcomeFrom(extracted, result.status);
  if (outcome === null) {
    // Never guess "confirmed". Flag it so staff review the transcript.
    outcome = "failed";
    extracted = {
      ...(extracted || {}),
      outcome_notes: extracted?.outcome_notes ?? extracted?.notes ?? "Call finished but the result could not be determined. Review the transcript."
    };
  }

  const updated = await callsRepository.complete(call.id, {
    status: outcome === "failed" ? "failed" : "completed",
    outcome,
    extracted,
    transcript: result.transcript,
    recordingUrl: result.recordingUrl,
    durationSeconds: result.durationSeconds
  });
  if (!updated) return;

  if (call.call_type === "delivery" && call.order_id !== null) {
    await applyDeliveryOutcome(call.customer_id, call.order_id, outcome, extracted || {});
  } else if (call.call_type === "onboarding") {
    await applyOnboardingOutcome(call.customer_id, outcome, extracted || {});
  }
}

async function applyDeliveryOutcome(_customerId: number, orderId: number, outcome: string, data: Record<string, unknown>): Promise<void> {
  const orderStatus = outcome === "verified" ? "confirmed" : outcome;
  await ordersRepository.applyDeliveryResult(orderId, orderStatus, data);

  if (outcome !== "no_answer") return;
  // Retries live in the database (status 'scheduled' + call_at), so they survive a restart.
  // The order scheduler picks them up; after the last attempt the order stays 'no_answer'.
  const { maxAttempts, retryDelayMinutes } = env.scheduler;
  const attempts = await ordersRepository.getAttempts(orderId);
  if (attempts < maxAttempts) {
    const retryAt = new Date(Date.now() + retryDelayMinutes * 60_000);
    const hhmm = retryAt.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });
    await ordersRepository.scheduleRetry(orderId, retryAt, `No answer. Retry ${attempts + 1} of ${maxAttempts} at ${hhmm} (Lagos).`);
  }
}

async function applyOnboardingOutcome(customerId: number, outcome: string, data: Record<string, unknown>): Promise<void> {
  if (outcome === "no_answer") await customersRepository.setStatus(customerId, "no_answer");
  else if (outcome === "failed") await customersRepository.setStatus(customerId, "called");
  else await customersRepository.applyOnboarding(customerId, data);
}