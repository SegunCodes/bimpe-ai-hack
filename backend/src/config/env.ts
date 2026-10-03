import "dotenv/config";

export const env = {
  // 3001 so the API and the Next.js frontend (port 3000) can run side by side.
  port: Number(process.env.PORT || 3001),
  mockCalls: process.env.MOCK_CALLS === "true",
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
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  databaseUrl: process.env.DATABASE_URL || "",
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL
  },
  bimpe: {
    apiKey: process.env.BIMPE_API_KEY,
    agentId: process.env.BIMPE_AGENT_ID,
    deliveryAgentId: process.env.BIMPE_DELIVERY_AGENT_ID,
    onboardingAgentId: process.env.BIMPE_ONBOARDING_AGENT_ID,
    // Test calls unless explicitly turned off. BimpeAI needs a real boolean, not the text "true".
    isTestCall: process.env.BIMPE_IS_TEST_CALL !== "false"
  }
};
