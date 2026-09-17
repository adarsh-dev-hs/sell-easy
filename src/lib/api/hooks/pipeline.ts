"use client"

import { type QueryKey, useQueryClient } from "@tanstack/react-query"
import type { Activity, Deal, DealStage, Entity, Paged, WithAccount, WithContact } from "@/lib/types"
import { api, type Query } from "../client"
import { useApiMutation, useApiQuery } from "../query"

export type DealRecord = WithContact<WithAccount<Entity<Deal>>>

export interface DealFilters extends Query {
  page?: number
  pageSize?: number
  q?: string
  sort?: string
  ownerId?: string
  accountId?: string
  stage?: DealStage[]
  hideClosed?: boolean
  source?: string
}

export interface PipelineStats {
  openPipeline: number
  openCount: number
  weightedPipeline: number
  wonThisQuarter: number
  wonThisQuarterCount: number
  winRate: number
  closedCount: number
  avgDealSize: number
  unsynced: number
  byStage: { stage: DealStage; label: string; count: number; amount: number }[]
}

export type DealInput = Pick<Deal, "name" | "accountId" | "stage" | "amount" | "closeDate"> &
  Partial<Pick<Deal, "contactId" | "ownerId" | "probability" | "source" | "notes">>

export const useDeals = (f: DealFilters) => useApiQuery(["deals", "list", f], () => api.page<DealRecord>("/deals", f))

export const usePipelineStats = (f: Pick<DealFilters, "ownerId" | "accountId" | "q"> = {}) =>
  useApiQuery(["deals", "stats", f], () => api.get<PipelineStats>("/deals/stats", f))

export const useDeal = (id: string | null | undefined) =>
  useApiQuery(["deals", "detail", id], () => api.get<DealRecord>(`/deals/${id}`), { enabled: !!id, placeholderData: undefined })

export const useDealActivities = (id: string | null | undefined) =>
  useApiQuery(["deals", "activities", id], () => api.page<Entity<Activity>>(`/deals/${id}/activities`, { pageSize: 20 }), {
    enabled: !!id,
  })

export function useCreateDeal() {
  return useApiMutation((body: DealInput) => api.post<Entity<Deal>>("/deals", body))
}

export function useUpdateDeal() {
  return useApiMutation(
    ({ id, ...body }: { id: string } & Partial<Omit<DealInput, "accountId" | "contactId">> & { contactId?: string | null }) =>
      api.patch<Entity<Deal>>(`/deals/${id}`, body),
  )
}

type MoveSnapshot = { lists: [QueryKey, Paged<DealRecord> | undefined][]; detail: [QueryKey, DealRecord | undefined] }

/**
 * Moves a deal to another stage. Optimistically updates every cached deal list and the deal
 * detail so board cards don't jump back while the request is in flight; rolls back on error.
 */
export function useMoveDeal() {
  const qc = useQueryClient()
  return useApiMutation(
    ({ id, stage }: { id: string; stage: DealStage }) => api.post<Entity<Deal>>(`/deals/${id}/move`, { stage }),
    {
      onMutate: async ({ id, stage }): Promise<MoveSnapshot> => {
        const listKey = ["deals", "list"]
        const detailKey = ["deals", "detail", id]
        await Promise.all([qc.cancelQueries({ queryKey: listKey }), qc.cancelQueries({ queryKey: detailKey })])
        const snapshot: MoveSnapshot = {
          lists: qc.getQueriesData<Paged<DealRecord>>({ queryKey: listKey }),
          detail: [detailKey, qc.getQueryData<DealRecord>(detailKey)],
        }
        const updatedAt = new Date().toISOString()
        qc.setQueriesData<Paged<DealRecord>>({ queryKey: listKey }, (old) =>
          old ? { ...old, data: old.data.map((d) => (d.id === id ? { ...d, stage, updatedAt } : d)) } : old,
        )
        qc.setQueryData<DealRecord>(detailKey, (old) => (old ? { ...old, stage } : old))
        return snapshot
      },
      onError: (_err, _vars, snapshot) => {
        const snap = snapshot as MoveSnapshot | undefined
        if (!snap) return
        for (const [key, data] of snap.lists) qc.setQueryData(key, data)
        qc.setQueryData(snap.detail[0], snap.detail[1])
      },
    },
  )
}

export function useDeleteDeal() {
  return useApiMutation((id: string) => api.delete(`/deals/${id}`), { successMessage: "Deal deleted" })
}

export function useSyncCrm() {
  return useApiMutation(() => api.post<{ pushed: number; crm: string; syncedAt: string }>("/deals/sync-crm"), {
    successMessage: (r) => `${r.pushed} deal${r.pushed === 1 ? "" : "s"} pushed to ${r.crm}`,
  })
}
