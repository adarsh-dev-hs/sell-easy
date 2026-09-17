"use client"

import type { AgentRun, Entity, OutreachDraft, PlaybookRule, Signal, WithAccount, WithContact } from "@/lib/types"
import { api, type Query } from "../client"
import { useApiMutation, useApiQuery } from "../query"

export type AgentRunRecord = WithAccount<Entity<AgentRun>> & { ruleName: string | null }
export type DraftRecord = WithContact<WithAccount<Entity<OutreachDraft>>>
export type PlaybookRecord = Entity<PlaybookRule> & { sequenceName: string | null }
export type PlaybookInput = Omit<PlaybookRule, "id" | "runs">

export interface AgentStats {
  runsToday: number
  runs7d: number
  totalRuns: number
  actionsTaken: number
  awaitingApproval: number
  completed: number
  failed: number
  successRate: number
  byStatus: { status: AgentRun["status"]; count: number }[]
}

export const useAgentSettings = () => useApiQuery(["agent", "settings"], () => api.get<{ autopilot: boolean }>("/agent/settings"))

export function useSetAutopilot() {
  return useApiMutation((autopilot: boolean) => api.patch<{ autopilot: boolean }>("/agent/settings", { autopilot }), {
    invalidate: [["agent", "settings"]],
    successMessage: (r) => (r.autopilot ? "Autopilot on — new signals are processed automatically" : "Autopilot off — signals will queue"),
  })
}

export const useAgentStats = () => useApiQuery(["agent", "stats"], () => api.get<AgentStats>("/agent/stats"))

export const useAgentRuns = (f: Query & { page?: number; pageSize?: number; status?: AgentRun["status"][]; accountId?: string }) =>
  useApiQuery(["agent", "runs", f], () => api.page<AgentRunRecord>("/agent/runs", f))

export const useAgentRun = (id: string | null | undefined) =>
  useApiQuery(
    ["agent", "run", id],
    () => api.get<AgentRunRecord & { signal: Entity<Signal> | null; drafts: DraftRecord[] }>(`/agent/runs/${id}`),
    { enabled: !!id, placeholderData: undefined },
  )

export const usePlaybooks = () => useApiQuery(["agent", "playbooks"], () => api.get<PlaybookRecord[]>("/agent/playbooks"))

export function useCreatePlaybook() {
  return useApiMutation((body: PlaybookInput) => api.post<Entity<PlaybookRule>>("/agent/playbooks", body), {
    successMessage: (r) => `Playbook “${r.name}” created`,
  })
}

export function useUpdatePlaybook() {
  return useApiMutation(
    ({ id, ...body }: Partial<Omit<PlaybookInput, "sequenceId">> & { id: string; sequenceId?: string | null }) =>
      api.patch<Entity<PlaybookRule>>(`/agent/playbooks/${id}`, body),
  )
}

export function useDeletePlaybook() {
  return useApiMutation((id: string) => api.delete(`/agent/playbooks/${id}`), { successMessage: "Playbook deleted" })
}

export const useDrafts = (f: Query & { status?: OutreachDraft["status"][]; page?: number; pageSize?: number }) =>
  useApiQuery(["agent", "drafts", f], () => api.page<DraftRecord>("/agent/drafts", f))

export function useApproveDraft() {
  return useApiMutation(({ id, ...edits }: { id: string; subject?: string; body?: string }) =>
    api.post<{
      draft: Entity<OutreachDraft>
      contact: { id: string; name: string }
      enrollment: { enrolled: number; sequence: { id: string; name: string } } | null
    }>(`/agent/drafts/${id}/approve`, edits),
  )
}

export function useRejectDraft() {
  return useApiMutation((id: string) => api.post<Entity<OutreachDraft>>(`/agent/drafts/${id}/reject`), {
    successMessage: "Draft rejected",
  })
}

export function useRegenerateDraft() {
  return useApiMutation((id: string) => api.post<Entity<OutreachDraft>>(`/agent/drafts/${id}/regenerate`), {
    successMessage: "Draft regenerated",
  })
}
