// Browser replacement for backend/src/config.ts (mock data mode). Same shape, fixed values.

export const DEMO_EMAIL = "jordan@acmegrowth.com"
export const DEMO_PASSWORD = "demo1234"

export const config = {
  NODE_ENV: "development" as "development" | "test" | "production",
  PORT: 0,
  API_PREFIX: "/api/v1",
  CORS_ORIGINS: "*",
  LOG_LEVEL: "warn" as const,
  JWT_SECRET: "mock-mode",
  JWT_EXPIRES_IN: "7d",
  ENCRYPTION_KEY: "0".repeat(64),
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 1_000_000,
  ENABLE_SIMULATION: true,
  ENABLE_ADMIN_RESET: true,
  IMPORT_MAX_BYTES: 5 * 1024 * 1024,

  BOOTSTRAP_ORG_NAME: "Acme Growth Inc.",
  BOOTSTRAP_ORG_DOMAIN: "acmegrowth.com",
  BOOTSTRAP_ADMIN_NAME: "Jordan Lee",
  BOOTSTRAP_ADMIN_EMAIL: DEMO_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD: DEMO_PASSWORD,

  DB_DRIVER: "json" as "json" | "postgres",
  DATA_DIR: "",
  DATABASE_URL: undefined as string | undefined,
  CACHE_DRIVER: "memory" as const,
  REDIS_URL: undefined as string | undefined,
  SEARCH_DRIVER: "memory" as const,
  EVENT_BUS_DRIVER: "memory" as const,
  AUTH_DRIVER: "local" as const,

  LLM_PROVIDER: "mock" as "mock" | "anthropic",
  ANTHROPIC_API_KEY: undefined as string | undefined,
  ANTHROPIC_MODEL: "claude-opus-5",
  ENRICHMENT_PROVIDER: "mock" as "mock" | "live",
  EMAIL_PROVIDER: "mock" as "mock" | "ses" | "instantly" | "mailpool",
  LINKEDIN_PROVIDER: "mock" as "mock" | "heyreach",
  CRM_PROVIDER: "mock" as "mock" | "hubspot" | "attio" | "salesforce",
  SLACK_WEBHOOK_URL: undefined as string | undefined,

  isProd: false,
  isTest: false,
  corsOrigins: ["*"],
  dataDir: "",
  enableSimulation: true,
  enableAdminReset: true,
}

export type Config = typeof config
