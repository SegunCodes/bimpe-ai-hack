import "dotenv/config";
import { createHash } from "node:crypto";

/** "true", "True", " 1 ", "yes" all count as on. */
const flag = (value: string | undefined): boolean => /^(true|1|yes|on)$/i.test((value || "").trim());

/**
 * The database URL. Accepts DATABASE_URL / POSTGRES_URL, and also the prefixed names Vercel's
 * Neon integration creates when a custom prefix is chosen (e.g. STORAGE_DATABASE_URL).
 * Pooled URLs are preferred over the *_UNPOOLED / *_NON_POOLING variants.
 */
function findDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (direct) return direct.trim();
  const names = Object.keys(process.env).sort();
  const pick = names.find((n) => /DATABASE_URL$/.test(n)) || names.find((n) => /POSTGRES_URL$/.test(n));
  return (pick ? process.env[pick] || "" : "").trim();
}

/** Names (never values) of database-looking settings, for the deployment self-check. */
export const databaseSettingNames = (): string[] =>
  Object.keys(process.env).filter((n) => /(DATABASE|POSTGRES|NEON|^PG)/i.test(n)).sort();

export const env = {
  // 3001 so the API and the Next.js frontend (port 3000) can run side by side.
  port: Number(process.env.PORT || 3001),
  mockCalls: flag(process.env.MOCK_CALLS),
  scheduler: {
    retryDelayMinutes: Number(process.env.RETRY_DELAY_MINUTES || 30),
    maxAttempts: Number(process.env.MAX_CALL_ATTEMPTS || 3)
  },
  tick: {
    /** Protects /api/cron/tick. Required in production. */
    cronSecret: process.env.CRON_SECRET || "",
    /** Local / always-on hosts: how often the background tick runs. */
    intervalMs: Number(process.env.TICK_INTERVAL_MS || 5_000),
    /** Minimum gap between ticks triggered by dashboard requests. */
    minGapMs: Number(process.env.TICK_MIN_GAP_MS || 5_000)
  },
  /** Public address of this API (used to tell BimpeAI where our tools live). */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, ""),
  admin: {
    // Password for the platform owner's /admin page. Empty means nobody can open it.
    password: (process.env.ADMIN_PASSWORD || "").trim()
  },
  auth: {
    /**
     * Signs business sign-in sessions. Defaults to a value derived from CRON_SECRET so no
     * extra setting is needed; set SESSION_SECRET to rotate it (signs every business out).
     */
    sessionSecret:
      (process.env.SESSION_SECRET || "").trim() ||
      (process.env.CRON_SECRET ? createHash("sha256").update(`tellero-sessions:${process.env.CRON_SECRET}`).digest("hex") : "")
  },
  capacity: {
    /** BimpeAI telephony minutes Tellero AI may use per calendar month unless /admin sets another number. */
    monthlyMinutes: Number(process.env.BIMPE_MONTHLY_MINUTES || 200),
    /** Most calls allowed on the phone at the same time, across every business. */
    maxConcurrentCalls: Math.max(1, Number(process.env.MAX_CONCURRENT_CALLS || 3)),
    /** What one BimpeAI minute costs Tellero AI, for the admin cost estimates. */
    costPerMinuteNaira: Number(process.env.BIMPE_COST_PER_MINUTE || 200),
    /** Minutes held back per call that is still on the phone (its length isn't known yet). */
    minutesPerLiveCall: 2
  },
  paystack: {
    /** Paystack secret key (sk_test_… or sk_live_…). Without it, plans can only be switched on from /admin. */
    secretKey: (process.env.PAYSTACK_SECRET_KEY || "").trim()
  },
  /** The dashboard's public address, for Paystack to send businesses back to after paying. */
  appUrl: (process.env.APP_URL || "").trim().replace(/\/+$/, ""),
  agentTools: {
    /**
     * Bearer token BimpeAI sends when its agent calls our tools mid-call.
     * Defaults to a value derived from CRON_SECRET so no extra setting is needed.
     */
    secret:
      (process.env.AGENT_TOOL_SECRET || "").trim() ||
      (process.env.CRON_SECRET ? createHash("sha256").update(`tellero-agent-tools:${process.env.CRON_SECRET}`).digest("hex") : "")
  },
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  // DATABASE_URL, or the POSTGRES_URL that Vercel's Neon integration also creates.
  databaseUrl: findDatabaseUrl(),
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL
  },
  bimpe: {
    /** BimpeAI Console API base (override only for testing). */
    apiBase: (process.env.BIMPE_API_BASE || "https://api.bimpe.ai/api/v1/console").replace(/\/+$/, ""),
    apiKey: process.env.BIMPE_API_KEY,
    agentId: process.env.BIMPE_AGENT_ID,
    deliveryAgentId: process.env.BIMPE_DELIVERY_AGENT_ID,
    onboardingAgentId: process.env.BIMPE_ONBOARDING_AGENT_ID,
    // Test calls unless explicitly turned off. BimpeAI needs a real boolean, not the text "true".
    isTestCall: process.env.BIMPE_IS_TEST_CALL !== "false"
  }
};
