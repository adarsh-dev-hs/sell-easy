import type { IntegrationCategory } from "@/lib/types"

export type ConfigField =
  | { key: string; label: string; description?: string; type: "switch"; default: boolean }
  | { key: string; label: string; description?: string; type: "select"; default: string; options: { value: string; label: string }[] }
  | { key: string; label: string; description?: string; type: "number"; default: string; min?: number; suffix?: string }

export const SYNC_INTERVALS = [
  { value: "15min", label: "Every 15 minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
]

export const LLM_MODELS = [
  { value: "claude-opus-5", label: "claude-opus-5" },
  { value: "claude-sonnet-5", label: "claude-sonnet-5" },
  { value: "claude-haiku-4-5", label: "claude-haiku-4-5" },
]

export const CATEGORY_FIELDS: Record<IntegrationCategory, ConfigField[]> = {
  enrichment: [
    { key: "useInWaterfall", label: "Use in waterfall", description: "Include this provider in the enrichment waterfall.", type: "switch", default: true },
    { key: "overwriteFields", label: "Overwrite existing fields", description: "Replace values already on the record.", type: "switch", default: false },
  ],
  contacts: [
    { key: "useInWaterfall", label: "Use in waterfall", description: "Include this provider in the enrichment waterfall.", type: "switch", default: true },
    { key: "verifyEmails", label: "Verify emails on import", type: "switch", default: true },
  ],
  intent: [
    {
      key: "minStrength",
      label: "Minimum signal strength",
      description: "Signals below this strength are dropped at ingestion.",
      type: "select",
      default: "50",
      options: [
        { value: "30", label: "30 — capture everything" },
        { value: "50", label: "50 — balanced" },
        { value: "70", label: "70 — high intent only" },
      ],
    },
  ],
  scraping: [{ key: "maxPages", label: "Max pages per run", type: "number", default: "500", min: 1, suffix: "pages" }],
  email: [
    { key: "dailyCap", label: "Daily send cap per mailbox", type: "number", default: "50", min: 1, suffix: "emails" },
    { key: "trackOpens", label: "Track opens", type: "switch", default: true },
  ],
  linkedin: [{ key: "dailyConnects", label: "Daily connection requests per sender", type: "number", default: "25", min: 1, suffix: "requests" }],
  calls: [{ key: "pushSummaries", label: "Push call summaries to CRM", type: "switch", default: true }],
  crm: [
    { key: "writeBack", label: "Write-back to CRM", description: "Push score, tier and agent activity back to the CRM.", type: "switch", default: true },
    {
      key: "conflictPolicy",
      label: "Conflict resolution",
      type: "select",
      default: "newest",
      options: [
        { value: "newest", label: "Most recent update wins" },
        { value: "crm", label: "CRM always wins" },
        { value: "selleasy", label: "SellEasy always wins" },
      ],
    },
  ],
  llm: [
    { key: "model", label: "Default model", description: "Used for scoring, research and outreach drafting.", type: "select", default: "claude-sonnet-5", options: LLM_MODELS },
    { key: "tokenBudget", label: "Monthly token budget", type: "number", default: "10000", min: 1, suffix: "k tokens" },
  ],
}

export const TILE_COLORS: Record<IntegrationCategory, string> = {
  enrichment: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  contacts: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  intent: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  scraping: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  email: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  linkedin: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  calls: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  crm: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  llm: "bg-stone-500/15 text-stone-700 dark:text-stone-300",
}
