"use client"

import type { AccountStage, AgentActionType, DealStage, IntegrationCategory, Organization, SignalType, StepChannel } from "@/lib/types"
import { api } from "../client"
import { useApiQuery } from "../query"

export interface Meta {
  industries: string[]
  countries: string[]
  technologies: string[]
  fundingStages: string[]
  signalLabels: Record<SignalType, string>
  signalSources: Record<SignalType, string[]>
  stageLabels: Record<AccountStage, string>
  dealStages: { id: DealStage; label: string; probability: number }[]
  actionLabels: Record<AgentActionType, string>
  stepChannelLabels: Record<StepChannel, string>
  apiScopes: string[]
  integrationCategories: IntegrationCategory[]
  planSeats: Record<Organization["plan"], number>
  features: { simulation: boolean; adminReset: boolean }
}

/** Business constants and feature flags served by the API (cached for the session). */
export const useMeta = () => useApiQuery(["meta"], () => api.get<Meta>("/meta"), { staleTime: Infinity })

export interface SearchResults {
  accounts: { id: string; name: string; domain: string }[]
  contacts: { id: string; name: string; title: string; email: string; accountId: string }[]
  deals: { id: string; name: string; accountId: string }[]
  sequences: { id: string; name: string }[]
}

export const useSearch = (q: string, enabled = true) =>
  useApiQuery(["search", q], () => api.get<SearchResults>("/search", { q, limit: 8 }), { enabled, staleTime: 10_000 })
