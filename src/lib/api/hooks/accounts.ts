"use client"

import type {
  Account,
  AccountStage,
  Activity,
  Contact,
  Deal,
  Entity,
  EnrollResult,
  EntityVersion,
  ImportResult,
  RescoreResult,
  Signal,
  Tier,
  WithContact,
} from "@/lib/types"
import { api, type Query } from "../client"
import { useApiMutation, useApiQuery } from "../query"

export type AccountRecord = Entity<Account>

export interface AccountFilters extends Query {
  page?: number
  pageSize?: number
  q?: string
  sort?: string
  view?: "all" | "mine" | "unassigned" | "duplicates"
  tier?: Tier[]
  industry?: string[]
  stage?: AccountStage[]
  country?: string[]
  ownerId?: string
  excludeDuplicates?: boolean
}

export type AccountInput = Pick<Account, "name" | "domain"> &
  Partial<
    Pick<
      Account,
      "industry" | "employees" | "revenue" | "country" | "city" | "technologies" | "fundingStage" | "description" | "linkedinUrl" | "ownerId" | "stage" | "tags"
    >
  >

export interface AccountDetail extends AccountRecord {
  related: { contacts: number; signals: number; deals: number; openDeals: number; openPipeline: number }
}

export interface ScoreBreakdown {
  fit: { label: string; points: number; max: number; matched: boolean; detail: string }[]
  fitScore: number
  intentScore: number
  score: number
  fitWeight: number
  intentDecayDays: number
  contributors: { signal: Entity<Signal>; weight: number; decay: number; points: number }[]
}

export interface DuplicatePair {
  duplicate: AccountRecord & { contactCount: number; source: string }
  canonical: (AccountRecord & { contactCount: number; source: string }) | null
}

export const accountKeys = {
  all: ["accounts"] as const,
  list: (f: AccountFilters) => ["accounts", "list", f] as const,
  detail: (id: string) => ["accounts", "detail", id] as const,
}

export const useAccounts = (f: AccountFilters, enabled = true) =>
  useApiQuery(accountKeys.list(f), () => api.page<AccountRecord>("/accounts", f), { enabled })

export const useAccountCounts = () =>
  useApiQuery(["accounts", "counts"], () =>
    api.get<{ all: number; mine: number; unassigned: number; duplicates: number }>("/accounts/counts"),
  )

export const useDuplicates = (enabled = true) =>
  useApiQuery(["accounts", "duplicates"], () => api.get<DuplicatePair[]>("/accounts/duplicates"), { enabled })

export const useAccount = (id: string | undefined) =>
  useApiQuery(accountKeys.detail(id ?? ""), () => api.get<AccountDetail>(`/accounts/${id}`), { enabled: !!id, placeholderData: undefined })

export const useScoreBreakdown = (id: string) =>
  useApiQuery(["accounts", "breakdown", id], () => api.get<ScoreBreakdown>(`/accounts/${id}/score-breakdown`))

export const useAccountVersions = (id: string) =>
  useApiQuery(["accounts", "versions", id], () => api.get<EntityVersion[]>(`/accounts/${id}/versions`))

export const useAccountContacts = (id: string | undefined) =>
  useApiQuery(["accounts", "contacts", id], () => api.get<Entity<Contact>[]>(`/accounts/${id}/contacts`), { enabled: !!id })

export const useAccountSignals = (id: string) =>
  useApiQuery(["accounts", "signals", id], () => api.get<WithContact<Entity<Signal>>[]>(`/accounts/${id}/signals`))

export const useAccountDeals = (id: string) =>
  useApiQuery(["accounts", "deals", id], () => api.get<Entity<Deal>[]>(`/accounts/${id}/deals`))

export const useAccountActivities = (id: string, pageSize = 100) =>
  useApiQuery(["accounts", "activities", id, pageSize], () =>
    api.page<Entity<Activity>>(`/accounts/${id}/activities`, { pageSize }),
  )

// ---------- Mutations ----------
export function useCreateAccount() {
  return useApiMutation((body: AccountInput) =>
    api.post<{ account: AccountRecord; duplicateOf: { id: string; name: string } | null }>("/accounts", body),
  )
}

export function useUpdateAccount() {
  return useApiMutation(({ id, ...body }: Partial<AccountInput> & { id: string }) =>
    api.patch<{ account: AccountRecord; rescore: RescoreResult | null }>(`/accounts/${id}`, body),
  )
}

export function useDeleteAccount() {
  return useApiMutation((id: string) => api.delete(`/accounts/${id}`), { successMessage: "Account deleted" })
}

export function useBulkDeleteAccounts() {
  return useApiMutation((ids: string[]) => api.post<{ deleted: number }>("/accounts/bulk-delete", { ids }), {
    successMessage: (r) => `${r.deleted} account${r.deleted === 1 ? "" : "s"} deleted`,
  })
}

export function useAssignOwner() {
  return useApiMutation((body: { ids: string[]; ownerId: string | null }) =>
    api.post<{ updated: number }>("/accounts/bulk-assign", body),
  )
}

export function useEnrichAccounts() {
  return useApiMutation((ids: string[]) =>
    api.post<{ enriched: number; results: { id: string; sources: string[]; rescore: RescoreResult | null }[] }>(
      "/accounts/bulk-enrich",
      { ids },
    ),
  )
}

export function useRescoreAccounts() {
  return useApiMutation((ids: string[]) =>
    api.post<{ results: (RescoreResult & { id: string })[] }>("/accounts/bulk-rescore", { ids }),
  )
}

export function useRescoreAccount() {
  return useApiMutation((id: string) => api.post<RescoreResult>(`/accounts/${id}/rescore`))
}

export function useEnrichAccount() {
  return useApiMutation((id: string) =>
    api.post<{ sources: string[]; rescore: RescoreResult | null; account: AccountRecord }>(`/accounts/${id}/enrich`),
  )
}

export function useBulkEnrollAccounts() {
  return useApiMutation((body: { ids: string[]; sequenceId: string }) => api.post<EnrollResult>("/accounts/bulk-enroll", body))
}

export function useEnrollAccountContacts() {
  return useApiMutation(({ id, ...body }: { id: string; sequenceId: string; contactIds?: string[] }) =>
    api.post<EnrollResult>(`/accounts/${id}/enroll`, body),
  )
}

export function useMergeDuplicate() {
  return useApiMutation((id: string) => api.post<AccountRecord>(`/accounts/${id}/merge`), {
    successMessage: (a) => `Merged into ${a.name}`,
  })
}

export function useDismissDuplicate() {
  return useApiMutation((id: string) => api.post<AccountRecord>(`/accounts/${id}/dismiss-duplicate`), {
    successMessage: "Marked as not a duplicate",
  })
}

// ---------- Import ----------
export interface ImportInput {
  format: "csv" | "json"
  content: string
  dryRun?: boolean
  updateExisting?: boolean
}

export function useImport(type: "accounts" | "contacts") {
  return useApiMutation((body: ImportInput) => api.post<ImportResult>(`/import/${type}`, body), {
    invalidate: "all",
  })
}

export const fetchImportTemplate = (type: "accounts" | "contacts") => api.text(`/import/templates/${type}`)
