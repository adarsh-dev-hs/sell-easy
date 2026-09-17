"use client"

import type { AgentRun, DealStage, Entity, Sequence, Signal, SignalType, Tier, User } from "@/lib/types"
import { api } from "../client"
import { useApiQuery } from "../query"

// ---------- Analytics ----------
export interface DashboardData {
  stats: {
    pipeline: number
    weighted: number
    won: number
    hotAccounts: number
    signals7d: number
    positiveReplies: number
    pendingDrafts: number
    openDeals: number
  }
  activity30d: { day: string; signals: number; agentActions: number }[]
  pipelineByStage: { stage: DealStage; label: string; amount: number; count: number }[]
  hotAccounts: { id: string; name: string; industry: string; employees: number; tier: Tier; intentScore: number; score: number }[]
  latestSignals: (Entity<Signal> & { accountName: string | null })[]
  latestRuns: { id: string; accountId: string; accountName: string | null; status: AgentRun["status"]; trigger: string; startedAt: string }[]
}

export interface AnalyticsOverview {
  range: { days: number; from: string; to: string }
  stats: {
    pipelineCreated: number
    dealsCreated: number
    revenueWon: number
    dealsWon: number
    replyRate: number
    replies: number
    meetings: number
    agentPipeline: number
    agentPct: number
    signals: number
  }
  pipelineByWeek: { week: string; agent: number; sequence: number; other: number }[]
  attribution: { type: SignalType; label: string; amount: number; deals: number }[]
  funnel: { step: string; count: number; conversion: number }[]
  tiers: { tier: Tier; accounts: number; deals: number; closed: number; winRate: number; avgDeal: number; pipeline: number; won: number }[]
  sequences: { id: string; name: string; status: Sequence["status"]; stats: Sequence["stats"]; openRate: number; replyRate: number; meetingRate: number }[]
  reps: { user: Pick<User, "id" | "name" | "email" | "role" | "avatarColor" | "title">; accountsOwned: number; openPipeline: number; wonAmount: number; dealsWon: number }[]
  sourceMix: { source: string; count: number }[]
}

export const useDashboard = () => useApiQuery(["analytics", "dashboard"], () => api.get<DashboardData>("/analytics/dashboard"))

export const useAnalyticsOverview = (days: number) =>
  useApiQuery(["analytics", "overview", days], () => api.get<AnalyticsOverview>("/analytics/overview", { days }))

export const fetchDealsCsv = (days: number) => api.text("/analytics/deals.csv", { days })

