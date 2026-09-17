"use client"

import type { ApiKey, Entity, Organization, Role, Session, User, UserPreferences } from "@/lib/types"
import { useAuthStore } from "../auth-store"
import { api } from "../client"
import { useApiMutation, useApiQuery } from "../query"

// ---------- Session ----------
export const useSession = () => {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const org = useAuthStore((s) => s.org)
  return { token, user, org, isAuthenticated: !!token }
}

/** The signed-in user (throws if used outside the authenticated layout). */
export function useCurrentUser() {
  const user = useAuthStore((s) => s.user)
  if (!user) throw new Error("useCurrentUser must be used inside the authenticated app")
  return user
}

export const canWrite = (role?: Role) => role !== undefined && role !== "viewer"
export const isAdmin = (role?: Role) => role === "owner" || role === "admin"

export function useMe() {
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)
  const setOrg = useAuthStore((s) => s.setOrg)
  return useApiQuery(
    ["auth", "me", token],
    async () => {
      const me = await api.get<{ user: User; org: Entity<Organization> }>("/auth/me")
      setUser(me.user)
      setOrg(me.org)
      return me
    },
    { enabled: !!token, staleTime: 60_000 },
  )
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  return useApiMutation((body: { email: string; password: string }) => api.post<Session>("/auth/login", body), {
    invalidate: "none",
    toastError: false,
    onSuccess: (s) => setSession(s),
  })
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession)
  return useApiMutation(
    (body: { orgName: string; domain: string; name: string; email: string; password: string }) =>
      api.post<Session>("/auth/register", body),
    { invalidate: "none", toastError: false, onSuccess: (s) => setSession(s) },
  )
}

export function useAcceptInvite() {
  const setSession = useAuthStore((s) => s.setSession)
  return useApiMutation(
    (body: { token: string; password: string; name?: string }) => api.post<Session>("/auth/accept-invite", body),
    { invalidate: "none", toastError: false, onSuccess: (s) => setSession(s) },
  )
}

export function useChangePassword() {
  return useApiMutation(
    (body: { currentPassword: string; newPassword: string }) => api.post<void>("/auth/change-password", body),
    { invalidate: "none", successMessage: "Password updated" },
  )
}

// ---------- Organization ----------
export type OrgWithSeats = Entity<Organization> & { seatsUsed: number }

export const useOrg = () => useApiQuery(["org"], () => api.get<OrgWithSeats>("/org"))

export function useUpdateOrg() {
  const setOrg = useAuthStore((s) => s.setOrg)
  return useApiMutation(
    (body: Partial<Pick<Organization, "name" | "domain" | "timezone">>) => api.patch<Entity<Organization>>("/org", body),
    { successMessage: "Organization updated", onSuccess: (o) => setOrg(o) },
  )
}

export function useChangePlan() {
  return useApiMutation((plan: Organization["plan"]) => api.post<Entity<Organization>>("/org/plan", { plan }), {
    successMessage: (o) => `Plan changed to ${o.plan}`,
  })
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser)
  return useApiMutation((body: Partial<Pick<User, "name" | "title" | "email">>) => api.patch<User>("/me", body), {
    successMessage: "Profile saved",
    onSuccess: (u) => setUser(u),
  })
}

export const usePreferences = () => useApiQuery(["me", "preferences"], () => api.get<UserPreferences>("/me/preferences"))

export function useSavePreferences() {
  return useApiMutation((body: UserPreferences) => api.put<UserPreferences>("/me/preferences", body), {
    invalidate: [["me", "preferences"]],
    successMessage: "Notification preferences saved",
  })
}

// ---------- Team ----------
export const useUsers = () => useApiQuery(["users"], () => api.get<User[]>("/users"), { staleTime: 60_000 })

export function useInviteUser() {
  return useApiMutation(
    (body: { email: string; role: Exclude<Role, "owner">; title?: string }) =>
      api.post<{ user: User; inviteToken: string }>("/users/invite", body),
    { successMessage: (r) => `Invitation sent to ${r.user.email}` },
  )
}

export function useResendInvite() {
  return useApiMutation((id: string) => api.post<{ user: User; inviteToken: string }>(`/users/${id}/resend-invite`), {
    invalidate: "none",
    successMessage: (r) => `Invitation re-sent to ${r.user.email}`,
  })
}

export function useUpdateUser() {
  return useApiMutation(
    ({ id, ...body }: { id: string; role?: Exclude<Role, "owner">; title?: string; name?: string }) =>
      api.patch<User>(`/users/${id}`, body),
    { successMessage: (u) => `${u.name} updated` },
  )
}

export function useRemoveUser() {
  return useApiMutation((id: string) => api.delete(`/users/${id}`), { successMessage: "Member removed" })
}

// ---------- API keys ----------
export const useApiKeys = (enabled = true) => useApiQuery(["api-keys"], () => api.get<ApiKey[]>("/api-keys"), { enabled })

export function useCreateApiKey() {
  return useApiMutation(
    (body: { name: string; scopes: string[] }) => api.post<{ apiKey: ApiKey; secret: string }>("/api-keys", body),
    { invalidate: [["api-keys"]] },
  )
}

export function useRevokeApiKey() {
  return useApiMutation((id: string) => api.post<ApiKey>(`/api-keys/${id}/revoke`), {
    invalidate: [["api-keys"]],
    successMessage: (k) => `“${k.name}” revoked`,
  })
}

// ---------- Admin ----------
export function useResetWorkspace() {
  return useApiMutation((body: { demo: boolean }) => api.post<{ reset: boolean; demo: boolean }>("/admin/reset", body), {
    successMessage: (r) => (r.demo ? "Workspace reset with demo data" : "Workspace data cleared"),
  })
}
