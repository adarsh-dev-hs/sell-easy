import type { PageMeta, Paged } from "@/lib/types"
import { useAuthStore } from "./auth-store"

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "")

/**
 * Where data comes from:
 * - "api"  (default) — the SellEasy backend at NEXT_PUBLIC_API_URL.
 * - "mock" — an in-browser copy of the backend with demo data (src/mock-api); no server needed.
 */
export const DATA_SOURCE: "api" | "mock" = process.env.NEXT_PUBLIC_DATA_SOURCE === "mock" ? "mock" : "api"
export const IS_MOCK = DATA_SOURCE === "mock"

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

function toSearchParams(query?: Query) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue
    if (Array.isArray(v)) {
      if (v.length) params.set(k, v.join(","))
    } else params.set(k, String(v))
  }
  return params
}

interface RawResponse {
  status: number
  statusText: string
  json: () => Promise<unknown>
  text: () => Promise<string>
}

async function send(method: string, path: string, query: Query | undefined, body: unknown, token: string | null): Promise<RawResponse> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  if (IS_MOCK) {
    const { mockRequest } = await import("@/mock-api/server")
    const res = await mockRequest({
      method,
      path,
      query: Object.fromEntries(toSearchParams(query)),
      body,
      headers: { authorization: headers.Authorization },
    })
    return {
      status: res.status,
      statusText: "",
      json: async () => res.json ?? null,
      text: async () => res.text ?? JSON.stringify(res.json ?? ""),
    }
  }

  const qs = toSearchParams(query).toString()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}${qs ? `?${qs}` : ""}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, "network_error", `Cannot reach the API at ${API_URL}. Is the backend running?`)
  }
  return { status: res.status, statusText: res.statusText, json: () => res.json(), text: () => res.text() }
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; raw?: boolean } = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const res = await send(method, path, opts.query, opts.body, token)
  const ok = res.status >= 200 && res.status < 300

  if (res.status === 401 && token) {
    useAuthStore.getState().clear()
  }
  if (res.status === 204) return undefined as T
  if (opts.raw) {
    if (!ok) throw new ApiError(res.status, "request_failed", res.statusText || "Request failed")
    return (await res.text()) as T
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: unknown; meta?: PageMeta; error?: { code: string; message: string; details?: unknown } }
    | null
  if (!ok || !json) {
    const err = json?.error
    throw new ApiError(res.status, err?.code ?? "request_failed", err?.message ?? (res.statusText || "Request failed"), err?.details)
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
