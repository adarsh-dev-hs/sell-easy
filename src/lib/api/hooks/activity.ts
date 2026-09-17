"use client"

import type { Activity, AppNotification, Entity } from "@/lib/types"
import { api } from "../client"
import { useApiMutation, useApiQuery } from "../query"

// ---------- Activities ----------
export const useActivities = (f: { accountId?: string; contactId?: string; dealId?: string; pageSize?: number }) =>
  useApiQuery(["activities", f], () => api.page<Entity<Activity>>("/activities", f))

export function useLogActivity() {
  return useApiMutation(
    (body: { type: Activity["type"]; title: string; detail?: string; accountId?: string; contactId?: string; dealId?: string }) =>
      api.post<Entity<Activity>>("/activities", body),
    { successMessage: "Activity logged" },
  )
}

// ---------- Notifications ----------
export const useNotifications = () =>
  useApiQuery(["notifications"], () => api.page<Entity<AppNotification>>("/notifications", { limit: 50 }), {
    refetchInterval: 30_000,
  })

export function useMarkNotificationRead() {
  return useApiMutation((id: string) => api.post(`/notifications/${id}/read`), { invalidate: [["notifications"]] })
}

export function useMarkAllNotificationsRead() {
  return useApiMutation(() => api.post<{ updated: number }>("/notifications/read-all"), { invalidate: [["notifications"]] })
}

