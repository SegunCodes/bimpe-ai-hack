import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { CallType } from "../types/models";

export interface StartCallInput {
  callType: CallType;
  phone: string;
  language?: string;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ParsedWebhook {
  providerCallId: string;
  status: string;
  transcript?: string;
  recordingUrl?: string;
  durationSeconds?: number;
  extracted?: Record<string, unknown>;
}

function agentIdFor(callType: CallType): string {
  const agentId = callType === "delivery"
    ? env.bimpe.deliveryAgentId || env.bimpe.agentId
    : env.bimpe.onboardingAgentId || env.bimpe.agentId;
  if (!agentId) throw new Error(`Missing BimpeAI agent ID for ${callType} calls`);
  return agentId;
}

// TODO: Implement when BimpeAI update-agent/prompt docs are available.
async function setAgentContextViaPromptUpdate(_context: Record<string, unknown>): Promise<void> {
  return;
}

export async function startCall(input: StartCallInput): Promise<{ providerCallId: string }> {
  if (env.mockCalls) return { providerCallId: `mock-${randomUUID()}` };

  if (!env.bimpe.apiKey) throw new Error("BIMPE_API_KEY is required when MOCK_CALLS=false");
  if (!/^\+[1-9]\d{6,14}$/.test(input.phone)) throw new Error("Destination must be a valid E.164 phone number");

  // Per-call variables, metadata and language are intentionally not sent: the documented
  // calls endpoint accepts only destination and is_test_call. Context is served by /api/agent-context.
  void input.language;
  void input.variables;
  void input.metadata;
  void setAgentContextViaPromptUpdate;

  const response = await fetch(`${env.bimpe.apiBase}/agents/${encodeURIComponent(agentIdFor(input.callType))}/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.bimpe.apiKey}`,
      "Content-Type": "application/json",
      // Same key for the same call record: a retried request can never ring the customer twice.
      "Idempotency-Key": `tellero-call-${String(input.metadata.callId ?? randomUUID())}`
    },
    body: JSON.stringify({ destination: input.phone, is_test_call: env.bimpe.isTestCall })
  });

  const payload = await response.json().catch(() => ({})) as {
    message?: string;
    data?: { call_id?: string; detail?: string; status?: string };
  };
  if (!response.ok) {
    const details: Record<number, string> = {
      400: "BimpeAI rejected the request or phone number",
      401: "BimpeAI rejected BIMPE_API_KEY",
      403: "BimpeAI denied the call; check live telephony and plan configuration",
      404: "BimpeAI agent was not found"
    };
    throw new Error(`${details[response.status] || `BimpeAI request failed (${response.status})`}: ${payload.data?.detail || payload.message || "no details"}`);
  }
  const providerCallId = payload.data?.call_id;
  if (!providerCallId) throw new Error("BimpeAI returned success without data.call_id");
  return { providerCallId };
}

const TERMINAL_STATUSES = ["ended", "busy", "failed", "cancelled"];

interface BimpeCallLog {
  role?: string;
  message?: string;
  created_at?: string;
}

/**
 * Fetches a call from BimpeAI. Returns null while the call is still queued/ringing/answered,
 * and a finished-call result (same shape as a webhook) once it has ended.
 */
export async function getCall(callType: CallType, providerCallId: string): Promise<ParsedWebhook | null> {
  if (!env.bimpe.apiKey) throw new Error("BIMPE_API_KEY is required to fetch calls");
  const url = `${env.bimpe.apiBase}/agents/${encodeURIComponent(agentIdFor(callType))}/calls/${encodeURIComponent(providerCallId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${env.bimpe.apiKey}` } });
  const payload = await response.json().catch(() => ({})) as {
    message?: string;
    data?: {
      status?: string;
      duration_seconds?: number;
      error_reason?: string | null;
      end_reason?: string | null;
      answered_at?: string | null;
      conversation_logs?: BimpeCallLog[];
    };
  };
  if (!response.ok) throw new Error(`BimpeAI get-call failed (${response.status}): ${payload.message || "no details"}`);

  const data = payload.data;
  const status = String(data?.status ?? "").toLowerCase();
  if (!data || !TERMINAL_STATUSES.includes(status)) return null;

  const transcript = (data.conversation_logs || [])
    .filter((log) => typeof log.message === "string" && log.message.trim() !== "")
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((log) => `${log.role ?? "unknown"}: ${log.message}`)
    .join("\n");

  // Map BimpeAI's call status onto the statuses our result service understands.
  let mappedStatus: string;
  if (status === "busy") mappedStatus = "busy";
  else if (status === "failed" || status === "cancelled") mappedStatus = "failed";
  else mappedStatus = data.answered_at ? "completed" : "no_answer";

  const reason = data.error_reason || data.end_reason;
  return {
    providerCallId,
    status: mappedStatus,
    ...(transcript ? { transcript } : {}),
    ...(typeof data.duration_seconds === "number" ? { durationSeconds: data.duration_seconds } : {}),
    ...(mappedStatus === "failed" ? { extracted: { outcome: "failed", outcome_notes: reason || `BimpeAI call ${status}` } } : {})
  };
}

export function parseWebhook(rawBody: Buffer | string | unknown, _headers: Record<string, string | string[] | undefined>): ParsedWebhook {
  const value = Buffer.isBuffer(rawBody)
    ? rawBody.toString("utf8")
    : typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody ?? {});
  const payload = JSON.parse(value) as Record<string, unknown>;
  const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
  const call = (data.call && typeof data.call === "object" ? data.call : data) as Record<string, unknown>;
  const providerCallId = call.call_id ?? call.provider_call_id ?? call.id ?? data.call_id;
  if (typeof providerCallId !== "string" || !providerCallId) throw new Error("Webhook is missing a call ID");

  const rawExtracted = call.extracted ?? call.extracted_data ?? call.structured_data ?? data.extracted;
  let extracted: Record<string, unknown> | undefined;
  if (rawExtracted && typeof rawExtracted === "object" && !Array.isArray(rawExtracted)) {
    extracted = rawExtracted as Record<string, unknown>;
  } else if (typeof rawExtracted === "string") {
    try {
      const decoded: unknown = JSON.parse(rawExtracted);
      if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) extracted = decoded as Record<string, unknown>;
    } catch {
      extracted = undefined;
    }
  }

  const duration = Number(call.duration_seconds ?? call.duration);
  const transcript = call.transcript ?? data.transcript;
  const recordingUrl = call.recording_url ?? call.recordingUrl ?? data.recording_url;
  return {
    providerCallId,
    status: String(call.status ?? data.status ?? "completed"),
    ...(typeof transcript === "string" ? { transcript } : {}),
    ...(typeof recordingUrl === "string" ? { recordingUrl } : {}),
    ...(Number.isFinite(duration) && duration >= 0 ? { durationSeconds: duration } : {}),
    ...(extracted ? { extracted } : {})
  };
}