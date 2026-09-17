"use client"

import type { Entity, Integration, IntegrationCategory } from "@/lib/types"
import { api } from "../client"
import { useApiMutation, useApiQuery } from "../query"

// ---------- Integrations ----------
export type IntegrationRecord = Entity<Integration>
export interface SyncLogEntry {
  at: string
  ok: boolean
  message: string
  durationMs: number
}
export type IntegrationDetail = IntegrationRecord & { syncLog: SyncLogEntry[] }
export type WaterfallProvider = IntegrationRecord & { position: number }

export interface IntegrationStats {
  total: number
  connected: number
  errors: number
  errorIds: string[]
  creditsUsed: number
  tokensUsed: number
}

export const useIntegrations = (f: { category?: IntegrationCategory[]; connected?: boolean; q?: string } = {}) =>
  useApiQuery(["integrations", "list", f], () => api.get<IntegrationRecord[]>("/integrations", f))

export const useIntegrationStats = () => useApiQuery(["integrations", "stats"], () => api.get<IntegrationStats>("/integrations/stats"))

export const useIntegration = (id: string | null | undefined) =>
  useApiQuery(
    ["integrations", "detail", id],
    () => api.get<IntegrationDetail>(`/integrations/${id}`),
    { enabled: !!id, placeholderData: undefined },
  )

export const useWaterfall = () =>
  useApiQuery(["integrations", "waterfall"], () => api.get<WaterfallProvider[]>("/integrations/waterfall"))

/** Connect or rotate the key (the API verifies it and answers 400 on a failed test). Success toast is left to the caller. */
export function useConnectIntegration() {
  return useApiMutation(({ id, apiKey }: { id: string; apiKey: string }) => api.post<IntegrationRecord>(`/integrations/${id}/connect`, { apiKey }))
}

export function useDisconnectIntegration() {
  return useApiMutation((id: string) => api.post<IntegrationRecord>(`/integrations/${id}/disconnect`), {
    successMessage: (i) => `${i.name} disconnected`,
  })
}

export function useSyncIntegration() {
  return useApiMutation((id: string) => api.post<IntegrationRecord>(`/integrations/${id}/sync`), {
    successMessage: (i) => `${i.name} synced`,
  })
}

export function useUpdateIntegrationSettings() {
  return useApiMutation(({ id, settings }: { id: string; settings: Integration["settings"] }) =>
    api.patch<IntegrationRecord>(`/integrations/${id}/settings`, settings),
    { successMessage: (i) => `${i.name} settings saved` },
  )
}

export function useSaveWaterfall() {
  return useApiMutation((keys: string[]) => api.put<WaterfallProvider[]>("/integrations/waterfall", { keys }), {
    invalidate: [["integrations"]],
  })
}
