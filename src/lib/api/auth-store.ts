"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { Entity, Organization, Session, User } from "@/lib/types"

/**
 * The only client-side persisted state: the session token plus a cached copy of the
 * signed-in user/org for instant first paint (refreshed from /auth/me on load).
 */
interface AuthState {
  token: string | null
  user: User | null
  org: Entity<Organization> | null
  setSession: (s: Session) => void
  setUser: (u: User) => void
  setOrg: (o: Entity<Organization>) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      org: null,
      setSession: ({ token, user, org }) => set({ token, user, org }),
      setUser: (user) => set({ user }),
      setOrg: (org) => set({ org }),
      clear: () => set({ token: null, user: null, org: null }),
    }),
    {
      name: "selleasy-session",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
)
