import type { PageMeta, Paged } from "@/lib/types"
import { useAuthStore } from "./auth-store"

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "")

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }

  /** Field-level validation messages from a 400 response, if any. */
  get fieldErrors(): Record<string, string[]> {
    const d = this.details as { fieldErrors?: Record<string, string[]> } | undefined
    return d?.fieldErrors ?? {}
  }
}

export type Query = Record<string, string | number | boolean | string[] | null | undefined>

function buildUrl(path: string, query?: Query) {
  const url = new URL(API_URL + path)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue
    if (Array.isArray(v)) {
      if (v.length) url.searchParams.set(k, v.join(","))
    } else url.searchParams.set(k, String(v))
  }
  return url.toString()
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; raw?: boolean } = {}): Promise<T> {
  const token = useAuthStore.getState().token
  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers: {
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, "network_error", `Cannot reach the API at ${API_URL}. Is the backend running?`)
  }

  if (res.status === 401 && token) {
    useAuthStore.getState().clear()
  }
  if (res.status === 204) return undefined as T
  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, "request_failed", res.statusText)
    return (await res.text()) as T
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: unknown; meta?: PageMeta; error?: { code: string; message: string; details?: unknown } }
    | null
  if (!res.ok || !json) {
    const err = json?.error
    throw new ApiError(res.status, err?.code ?? "request_failed", err?.message ?? res.statusText, err?.details)
  }
  return (json.meta ? { data: json.data, meta: json.meta } : json.data) as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  /** GET for paginated endpoints → `{ data, meta }` */
  page: <T>(path: string, query?: Query) => request<Paged<T>>("GET", path, { query }),
  text: (path: string, query?: Query) => request<string>("GET", path, { query, raw: true }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body: body ?? {} }),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
}

/** Human-readable message for toasts. */
export function errorMessage(err: unknown) {
  if (err instanceof ApiError) {
    const fields = Object.entries(err.fieldErrors)
    if (fields.length) return fields.map(([f, m]) => `${f}: ${m[0]}`).join(" · ")
    return err.message
  }
  return err instanceof Error ? err.message : "Something went wrong"
}

/** Triggers a browser download of text content. */
export function downloadText(content: string, filename: string, type = "text/csv") {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
