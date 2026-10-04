import { env } from "../../config/env";
import { one, rows, run } from "../../db/pool";
import { agentIds, runBimpeSetup, setupFingerprint } from "./bimpeSetup.service";

const KEY = "bimpe_setup";
const REPORT_KEY = "bimpe_setup_report";
const RETRY_FAILED_AFTER_MINUTES = 30;
const RUNNING_TIMEOUT_MINUTES = 5;

/**
 * The public address BimpeAI should call our tools on: PUBLIC_BASE_URL if set, otherwise
 * Vercel's production domain (Vercel sets VERCEL_PROJECT_PRODUCTION_URL automatically).
 */
export function toolsBaseUrl(): string {
  if (env.publicBaseUrl) return env.publicBaseUrl;
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  return vercel ? `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` : "";
}

/** Remembers that BimpeAI has this exact setup, with a short report for the self-check page. */
export async function recordSetup(fingerprint: string, ok: boolean, report: unknown): Promise<void> {
  await run(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() RETURNING key`, [KEY, `${ok ? "done" : "failed"}:${fingerprint}`]);
  await run(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() RETURNING key`, [REPORT_KEY, JSON.stringify(report)]);
}

/**
 * Sends the call script and tools to BimpeAI whenever they change, so nobody has to open the
 * setup link after a deploy. Runs on each background tick; does nothing (one small read) when
 * BimpeAI is already up to date. A failed attempt is retried after 30 minutes.
 * Only one instance can claim a given change, so two ticks never set up the agent twice.
 */
export async function syncAgentIfChanged(): Promise<"up_to_date" | "skipped" | "updated" | "failed"> {
  const base = toolsBaseUrl();
  if (!env.bimpe.apiKey || !env.agentTools.secret || agentIds().length === 0 || !base) return "skipped";

  const fingerprint = setupFingerprint(base);
  const current = await one<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", [KEY]);
  if (current?.value === `done:${fingerprint}`) return "up_to_date";

  // Claim the change. Not claimable while another instance is running it, or within
  // 30 minutes of this same version failing.
  const claimed = await rows<{ key: string }>(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    WHERE NOT (app_settings.value LIKE 'running:%' AND app_settings.updated_at > now() - interval '${RUNNING_TIMEOUT_MINUTES} minutes')
      AND NOT (app_settings.value = ? AND app_settings.updated_at > now() - interval '${RETRY_FAILED_AFTER_MINUTES} minutes')
      AND app_settings.value <> ?
    RETURNING key`, [KEY, `running:${fingerprint}`, `failed:${fingerprint}`, `done:${fingerprint}`]);
  if (claimed.length === 0) return "skipped";

  try {
    const report = await runBimpeSetup(base);
    await recordSetup(fingerprint, report.ok, { ...report, automatic: true });
    if (!report.ok) console.error("Automatic BimpeAI setup did not finish:", JSON.stringify(report));
    return report.ok ? "updated" : "failed";
  } catch (error) {
    await recordSetup(fingerprint, false, { ok: false, automatic: true, error: (error as Error).message });
    console.error("Automatic BimpeAI setup failed:", error);
    return "failed";
  }
}

/** For the self-check page: whether BimpeAI has the latest script, and when it was sent. */
export async function agentSetupStatus(): Promise<Record<string, unknown>> {
  const base = toolsBaseUrl();
  if (!env.bimpe.apiKey) return { status: "waiting for BIMPE_API_KEY" };
  if (agentIds().length === 0) return { status: "waiting for a BimpeAI agent ID" };
  if (!base) return { status: "waiting for PUBLIC_BASE_URL" };
  const state = await one<{ value: string; updated_at: Date }>("SELECT value, updated_at FROM app_settings WHERE key = ?", [KEY]);
  const report = await one<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", [REPORT_KEY]);
  const fingerprint = setupFingerprint(base);
  const [phase, version] = (state?.value || "").split(":");
  let status = "not sent yet (happens within a minute)";
  if (version === fingerprint) {
    status = phase === "done" ? "up to date" : phase === "running" ? "sending now" : `last attempt failed; retrying within ${RETRY_FAILED_AFTER_MINUTES} minutes`;
  } else if (state) {
    status = "script changed; sending within a minute";
  }
  // This page is public, so show only BimpeAI's error messages, never agent IDs.
  let problem: string | undefined;
  try {
    const parsed = report ? JSON.parse(report.value) as { error?: string; agents?: Record<string, { ok: boolean; detail?: string }[]> } : undefined;
    problem = parsed?.error ?? Object.values(parsed?.agents ?? {}).flat().find((s) => !s.ok)?.detail;
  } catch {
    problem = undefined;
  }
  return { status, lastSentAt: state?.updated_at ?? null, ...(phase === "failed" && problem ? { problem } : {}) };
}
