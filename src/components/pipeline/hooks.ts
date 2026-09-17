"use client"

import { useEffect, useMemo, useState } from "react"
import { useIntegrations, useUsers } from "@/lib/api"
import type { User } from "@/lib/types"

/** Returns `value` after it has been stable for `ms` milliseconds. */
export function useDebounced<T>(value: T, ms = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/** Team members keyed by id, plus the list of users that can own deals (non-viewers). */
export function useTeam() {
  const { data: users } = useUsers()
  return useMemo(() => {
    const list = users ?? []
    const byId = new Map<string, User>(list.map((u) => [u.id, u]))
    return { users: list, sellers: list.filter((u) => u.role !== "viewer"), byId }
  }, [users])
}

/** Display name of the connected CRM (falls back to "CRM"). */
export function useCrmName() {
  const { data } = useIntegrations({ category: ["crm"], connected: true })
  return data?.[0]?.name ?? "CRM"
}
