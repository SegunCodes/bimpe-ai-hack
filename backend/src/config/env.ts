import "dotenv/config";

export const env = {
  // 3001 so the API and the Next.js frontend (port 3000) can run side by side.
  port: Number(process.env.PORT || 3001),
  mockCalls: process.env.MOCK_CALLS === "true",
  scheduler: {
    intervalMs: Number(process.env.SCHEDULER_INTERVAL_MS || 15_000),
    retryDelayMinutes: Number(process.env.RETRY_DELAY_MINUTES || 30),
    maxAttempts: Number(process.env.MAX_CALL_ATTEMPTS || 3)
  },
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  databaseUrl: process.env.DATABASE_URL || "",
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL
  },
  bimpe: {
    apiKey: process.env.BIMPE_API_KEY,
    agentId: process.env.BIMPE_AGENT_ID,
    deliveryAgentId: process.env.BIMPE_DELIVERY_AGENT_ID,
    onboardingAgentId: process.env.BIMPE_ONBOARDING_AGENT_ID,
    isTestCall: process.env.BIMPE_IS_TEST_CALL
  }
};
