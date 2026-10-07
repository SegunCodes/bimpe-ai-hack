import { createHash } from "node:crypto";
import { env } from "../../config/env";
import { AGENT_PROFILE, TELLERO_SYSTEM_PROMPT, TOOL_NAMES } from "./agentPrompt";

const INTEGRATION_NAME = "Tellero orders";

interface Envelope<T> { data: T; message?: string }
type Step = { step: string; ok: boolean; detail?: string };

/** Minimal BimpeAI Console API client for the setup steps. Errors carry BimpeAI's own message. */
async function bimpe<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${env.bimpe.apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.bimpe.apiKey}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string } & Partial<Envelope<T>>;
  if (!response.ok) {
    throw new Error(`BimpeAI ${method} ${path.replace(/\/[A-Za-z0-9_-]{8,}/g, "/…")} failed (${response.status}${payload.code ? ` ${payload.code}` : ""}): ${payload.message || "no details"}`);
  }
  return payload.data as T;
}

const CONTEXT_TOOL = {
  name: TOOL_NAMES.context,
  description: "Call this before saying anything on every call. Returns opening_line (your exact first words), call_id, call_type, business_name, about_business, and the customer, order or rider details.",
  http_method: "GET",
  url_template: "/context?phone={{phone}}",
  url_params: [{ name: "phone", type: "string", description: "The number you are calling, E.164 format e.g. +2348031234567. Leave empty if unknown.", required: false }],
  timeout: 10_000
};

const RESULT_TOOL = {
  name: TOOL_NAMES.result,
  description: "Call this once before ending the call to record what the customer said.",
  http_method: "POST",
  url_template: "/result",
  body_params: [
    { name: "call_id", type: "integer", description: "call_id from Get call context", required: false },
    { name: "outcome", type: "string", description: "confirmed, address_updated, rescheduled, failed (delivery), verified (onboarding) or briefed (rider)", required: true },
    { name: "cleaned_address", type: "string", description: "Full street address with house number and area", required: false },
    { name: "landmark", type: "string", description: "A landmark a rider can see", required: false },
    { name: "reschedule_time", type: "string", description: "New delivery day and time if rescheduled", required: false },
    { name: "notes", type: "string", description: "One short sentence about the call", required: false },
    { name: "language", type: "string", description: "Onboarding: English, Pidgin, Yoruba, Hausa or Igbo", required: false },
    { name: "best_time_to_call", type: "string", description: "Onboarding: best time to call before deliveries", required: false },
    { name: "consent_to_calls", type: "boolean", description: "Onboarding: agrees to delivery calls", required: false }
  ],
  timeout: 10_000
};

/**
 * A fingerprint of everything setup sends to BimpeAI. When it changes (new script, new tools,
 * new agent, new address or secret) the backend knows BimpeAI needs updating.
 * The tool token is hashed in, never stored.
 */
export function setupFingerprint(publicBaseUrl: string): string {
  return createHash("sha256")
    .update(JSON.stringify([TELLERO_SYSTEM_PROMPT, AGENT_PROFILE, CONTEXT_TOOL, RESULT_TOOL, INTEGRATION_NAME, publicBaseUrl, agentIds(), env.agentTools.secret]))
    .digest("hex")
    .slice(0, 16);
}

/** The agent IDs configured for this deployment (delivery, onboarding, shared fallback), deduplicated. */
export function agentIds(): string[] {
  return [...new Set([env.bimpe.deliveryAgentId, env.bimpe.onboardingAgentId, env.bimpe.agentId].filter((id): id is string => Boolean(id && id.trim())).map((id) => id.trim()))];
}

/**
 * Makes each BimpeAI agent ready for Tellero AI calls. Safe to run again: every step checks
 * what exists first, so re-running just re-applies the latest script and tools.
 *   1. make sure the agent has a workflow the team owns (copy a public one if needed)
 *   2. write the Tellero AI script to the workflow's system prompt
 *   3. set the agent's business name, description, timezone and persona
 *   4. (re)register this API as a custom integration with two tools
 */
export async function runBimpeSetup(publicBaseUrl: string): Promise<{ ok: boolean; agents: Record<string, Step[]> }> {
  if (!env.bimpe.apiKey) throw new Error("BIMPE_API_KEY is not set in this deployment");
  if (!env.agentTools.secret) throw new Error("CRON_SECRET is not set (the agent tool token is derived from it)");
  const ids = agentIds();
  if (ids.length === 0) throw new Error("No BimpeAI agent ID set (BIMPE_DELIVERY_AGENT_ID / BIMPE_ONBOARDING_AGENT_ID / BIMPE_AGENT_ID)");

  const agents: Record<string, Step[]> = {};
  for (const agentId of ids) {
    const steps: Step[] = [];
    const record = (step: string, ok: boolean, detail?: string) => steps.push({ step, ok, ...(detail ? { detail } : {}) });
    agents[agentId] = steps;
    const a = `/agents/${encodeURIComponent(agentId)}`;

    try {
      // 1. A workflow we own
      const agent = await bimpe<{ name: string; workflow_id: string | null }>("GET", a);
      record("found agent", true, agent.name);
      let workflowId = agent.workflow_id;
      if (workflowId) {
        const workflow = await bimpe<{ id: string; is_owner: boolean }>("GET", `/workflows/${encodeURIComponent(workflowId)}`);
        if (!workflow.is_owner) {
          const copy = await bimpe<{ id: string }>("POST", "/workflows/clone", { source_workflow_id: workflowId });
          workflowId = copy.id;
          await bimpe("PATCH", a, { workflow_id: workflowId });
          record("copied the public workflow so it can be edited", true);
        }
      } else {
        const created = await bimpe<{ id: string }>("POST", "/workflows", { name: "Tellero AI delivery calls", system_prompt: TELLERO_SYSTEM_PROMPT });
        workflowId = created.id;
        await bimpe("PATCH", a, { workflow_id: workflowId });
        record("created a Tellero AI workflow", true);
      }

      // 2. The script
      await bimpe("PATCH", `/workflows/${encodeURIComponent(workflowId as string)}`, { system_prompt: TELLERO_SYSTEM_PROMPT });
      record("wrote the Tellero AI call script", true);

      // 2b. A copied template can bring its own canned flows and rules (such as an inbound
      // "How can I help you today?" greeting). Clear them so only our script decides what is said.
      try {
        await bimpe("PATCH", `/workflows/${encodeURIComponent(workflowId as string)}`, { flows: [], rules: [] });
        record("cleared template greetings and flows", true);
      } catch (error) {
        // Not fatal: the script still tells the agent how to open.
        steps.push({ step: "clear template greetings and flows", ok: true, detail: `skipped: ${(error as Error).message}` });
      }

      // 3. Business profile
      await bimpe("PATCH", a, AGENT_PROFILE);
      record("set business name, timezone (Africa/Lagos) and persona", true);

      // 4. Our tools: remove an older Tellero AI integration, then register a fresh one
      const existing = await bimpe<{ id: string; config: { name: string } }[]>("GET", `${a}/integrations/custom_api`);
      for (const old of (existing || []).filter((i) => i.config?.name === INTEGRATION_NAME)) {
        await bimpe("DELETE", `${a}/integrations/custom_api/${encodeURIComponent(old.id)}`);
      }
      const integration = await bimpe<{ id: string }>("POST", `${a}/integrations/custom_api/configure`, {
        name: INTEGRATION_NAME,
        description: "Tellero AI order and customer details for delivery and onboarding calls",
        base_url: `${publicBaseUrl}/api/agent-tools`,
        auth_type: "bearer",
        auth_config: { token: env.agentTools.secret }
      });
      const i = `${a}/integrations/custom_api/${encodeURIComponent(integration.id)}/tools`;
      await bimpe("POST", i, CONTEXT_TOOL);
      await bimpe("POST", i, RESULT_TOOL);
      record(`connected ${publicBaseUrl}/api/agent-tools with tools "${TOOL_NAMES.context}" and "${TOOL_NAMES.result}"`, true);
    } catch (error) {
      record("stopped", false, (error as Error).message);
    }
  }
  return { ok: Object.values(agents).every((s) => s.every((x) => x.ok)), agents };
}
