import type {
  AccountStage,
  AgentActionType,
  DealStage,
  IntegrationCategory,
  Role,
  SignalType,
  StepChannel,
  Tier,
} from "./types"

export const INDUSTRIES = [
  "SaaS",
  "Fintech",
  "Healthcare",
  "E-commerce",
  "Cybersecurity",
  "Logistics",
  "Manufacturing",
  "EdTech",
  "Media",
  "Real Estate",
]

export const COUNTRIES = ["United States", "United Kingdom", "Germany", "Canada", "India", "Australia", "France", "Netherlands"]

export const TECHNOLOGIES = [
  "Salesforce",
  "HubSpot",
  "Snowflake",
  "AWS",
  "GCP",
  "Segment",
  "Stripe",
  "Zendesk",
  "Intercom",
  "Marketo",
  "Outreach",
  "Gong",
  "Slack",
  "Okta",
]

export const FUNDING_STAGES = ["Bootstrapped", "Seed", "Series A", "Series B", "Series C", "Series D+", "Public"]

export const SIGNAL_LABELS: Record<SignalType, string> = {
  intent_topic: "Intent topic",
  website_visit: "Website visit",
  hiring: "Hiring",
  funding: "Funding",
  job_change: "Job change",
  tech_install: "Tech install",
  social_engagement: "Social engagement",
  news: "News",
}

export const SIGNAL_SOURCES: Record<SignalType, string[]> = {
  intent_topic: ["Bombora"],
  website_visit: ["RB2B"],
  hiring: ["Apify", "Linkup"],
  funding: ["Linkup", "Apollo.io"],
  job_change: ["Trigify.io", "Apollo.io"],
  tech_install: ["Clearbit", "Apify"],
  social_engagement: ["Trigify.io"],
  news: ["Linkup"],
}

export const STAGE_LABELS: Record<AccountStage, string> = {
  new: "New",
  researching: "Researching",
  engaged: "Engaged",
  opportunity: "Opportunity",
  customer: "Customer",
  disqualified: "Disqualified",
}

export const DEAL_STAGES: { id: DealStage; label: string; probability: number }[] = [
  { id: "discovery", label: "Discovery", probability: 10 },
  { id: "qualified", label: "Qualified", probability: 25 },
  { id: "demo", label: "Demo", probability: 40 },
  { id: "proposal", label: "Proposal", probability: 60 },
  { id: "negotiation", label: "Negotiation", probability: 80 },
  { id: "closed_won", label: "Closed won", probability: 100 },
  { id: "closed_lost", label: "Closed lost", probability: 0 },
]

export const DEAL_STAGE_LABEL = Object.fromEntries(DEAL_STAGES.map((s) => [s.id, s.label])) as Record<DealStage, string>

export const ACTION_LABELS: Record<AgentActionType, string> = {
  rescore: "Re-score account",
  route_owner: "Route to owner",
  draft_outreach: "Draft outreach",
  enroll_sequence: "Enroll in sequence",
  create_deal: "Create deal",
  notify: "Notify owner",
  enrich: "Enrich account",
}

export const STEP_CHANNEL_LABELS: Record<StepChannel, string> = {
  email: "Email",
  linkedin_connect: "LinkedIn connect",
  linkedin_message: "LinkedIn message",
  call: "Call task",
  wait: "Wait",
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
}

export const INTEGRATION_CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  enrichment: "Enrichment",
  intent: "Intent & signals",
  contacts: "TAM & contacts",
  scraping: "Web scraping",
  email: "Email deliverability",
  linkedin: "LinkedIn outreach",
  calls: "Call intelligence",
  crm: "CRM sync",
  llm: "LLM",
}

export const TIER_STYLES: Record<Tier, string> = {
  A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  B: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  C: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  D: "bg-muted text-muted-foreground border-border",
}

export const API_SCOPES = ["accounts:read", "accounts:write", "signals:write", "outreach:read", "outreach:write", "pipeline:read", "pipeline:write"]
