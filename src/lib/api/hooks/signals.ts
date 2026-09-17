"use client"

import type { AgentRun, Entity, IcpConfig, Signal, SignalType, Tier, WithAccount, WithContact } from "@/lib/types"
import { api, type Query } from "../client"
import { useApiMutation, useApiQuery } from "../query"

export type SignalRecord = WithContact<WithAccount<Entity<Signal>>>
export type RunRecord = Entity<AgentRun>

export interface SignalFilters extends Query {
  page?: number
  pageSize?: number
  q?: string
  type?: SignalType[]
  source?: string[]
  processed?: boolean
  accountId?: string
  sinceDays?: number
}

export interface SignalStats {
  total: number
  last24h: number
  last7d: number
  unprocessed: number
  topSource: string | null
  bySource: { source: string; count: number }[]
  byType30d: { type: SignalType; count: number }[]
}

export interface IngestInput {
  type: SignalType
  accountId?: string
  domain?: string
  contactId?: string
  title: string
  detail?: string
  strength: number
  source?: string
}

export interface IngestResult {
  signal: Entity<Signal>
  run: RunRecord | null
}

export const useSignals = (f: SignalFilters) => useApiQuery(["signals", "list", f], () => api.page<SignalRecord>("/signals", f))

export const useSignalStats = () => useApiQuery(["signals", "stats"], () => api.get<SignalStats>("/signals/stats"))

export const useSignal = (id: string | undefined | null) =>
  useApiQuery(["signals", "detail", id], () => api.get<SignalRecord & { runs: RunRecord[] }>(`/signals/${id}`), {
    enabled: !!id,
    placeholderData: undefined,
  })

export function useIngestSignal() {
  return useApiMutation((body: IngestInput) => api.post<IngestResult>("/signals", body))
}

export function useSimulateSignal() {
  return useApiMutation(() => api.post<IngestResult>("/signals/simulate"))
}

export function useProcessSignal() {
  return useApiMutation((id: string) => api.post<RunRecord>(`/signals/${id}/process`))
}

export function useProcessPending() {
  return useApiMutation(() => api.post<{ processed: number; runs: RunRecord[] }>("/signals/process-pending"), {
    successMessage: (r) => (r.processed ? `Processed ${r.processed} pending signal${r.processed === 1 ? "" : "s"}` : "No pending signals"),
  })
}

export function useDeleteSignal() {
  return useApiMutation((id: string) => api.delete(`/signals/${id}`), { successMessage: "Signal deleted" })
}

// ---------- ICP & scoring ----------
export type IcpInput = Omit<IcpConfig, "id" | "updatedAt">

export interface IcpPreview {
  total: number
  distribution: { tier: Tier; current: number; draft: number }[]
  tierChanges: number
  promoted: number
  demoted: number
  avgCurrent: number
  avgDraft: number
  top: {
    id: string
    name: string
    domain: string
    industry: string
    currentScore: number
    currentTier: Tier
    score: number
    tier: Tier
    delta: number
  }[]
}

export const useIcp = () => useApiQuery(["icp"], () => api.get<Entity<IcpConfig & { id: string }>>("/icp"), { placeholderData: undefined })

export const useIcpDefaults = () => useApiQuery(["icp", "defaults"], () => api.get<IcpConfig>("/icp/defaults"), { staleTime: Infinity })

export const useIcpPreview = (icp: IcpInput | null, enabled = true) =>
  useApiQuery(["icp", "preview", icp], () => api.post<IcpPreview>("/icp/preview", { icp, top: 10 }), {
    enabled: enabled && !!icp,
    staleTime: 30_000,
  })

export function useSaveIcp() {
  return useApiMutation((icp: IcpInput) => api.put<{ icp: IcpConfig; changed: number }>("/icp", icp), {
    successMessage: (r) => `ICP saved — ${r.changed} account${r.changed === 1 ? "" : "s"} changed score or tier`,
  })
}

/** Strips server bookkeeping fields from an ICP record so it can be sent back. */
export function toIcpInput(icp: IcpConfig & { orgId?: string; createdAt?: string }): IcpInput {
  const { industries, countries, employeeMin, employeeMax, revenueMin, technologies, fundingStages, fitWeight, signalWeights, intentDecayDays, tierThresholds } = icp
  return { industries, countries, employeeMin, employeeMax, revenueMin, technologies, fundingStages, fitWeight, signalWeights, intentDecayDays, tierThresholds }
}
