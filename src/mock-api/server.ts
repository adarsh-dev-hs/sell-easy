/**
 * In-browser API used when NEXT_PUBLIC_DATA_SOURCE=mock.
 *
 * It runs the backend's real route definitions and services (synced into ./core) against a
 * localStorage-backed database seeded with the demo dataset, so every screen behaves exactly as it
 * does against the Express API — without a server. Loaded lazily by src/lib/api/client.ts.
 */
import { DEMO_EMAIL, DEMO_PASSWORD } from "./core/config"
import { db } from "./core/db"
import { MOCK_DB_PREFIX, suspendPersistence } from "./core/db/json/json-repository"
import { errorOutput, executeRoute, type RegisteredRoute, routeRegistry } from "./core/lib/route-runtime"
import { createOrganization } from "./core/modules/organization/service"
import { seedDemoData } from "./core/seed/demo"

// Registering a module's routes happens on import (same list as backend/src/app.ts).
import "./core/modules/auth/routes"
import "./core/modules/organization/routes"
import "./core/modules/meta/routes"
import "./core/modules/accounts/routes"
import "./core/modules/contacts/routes"
import "./core/modules/signals/routes"
import "./core/modules/scoring/routes"
import "./core/modules/agent/routes"
import "./core/modules/outreach/routes"
import "./core/modules/pipeline/routes"
import "./core/modules/activities/routes"
import "./core/modules/notifications/routes"
import "./core/modules/analytics/routes"
import "./core/modules/integrations/routes"
import "./core/modules/search/routes"
import "./core/modules/import/routes"
import "./core/modules/admin/routes"

export { DEMO_EMAIL, DEMO_PASSWORD }

export interface MockRequest {
  method: string
  path: string
  query?: Record<string, string>
  body?: unknown
  headers: Record<string, string | undefined>
}

export interface MockResponse {
  status: number
  json?: unknown
  text?: string
}

interface CompiledRoute {
  route: RegisteredRoute
  regex: RegExp
  keys: string[]
}

let compiled: CompiledRoute[] | null = null

function compile(): CompiledRoute[] {
  compiled ??= routeRegistry.map((route) => {
    const keys: string[] = []
    const pattern = route.fullPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:([A-Za-z_]+)/g, (_m, k: string) => {
      keys.push(k)
      return "([^/]+)"
    })
    return { route, regex: new RegExp(`^${pattern}/?$`), keys }
  })
  return compiled
}

let seeding: Promise<void> | null = null

/** Creates the demo workspace the first time the mock API is used in this browser. */
function ensureSeeded() {
  seeding ??= (async () => {
    if (await db.users.findGlobal({ email: DEMO_EMAIL })) return
    const { org, owner } = await createOrganization({
      orgName: "Acme Growth Inc.",
      domain: "acmegrowth.com",
      ownerName: "Jordan Lee",
      ownerEmail: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    })
    await seedDemoData(org.id, owner.id)
  })()
  return seeding
}

const latency = () => new Promise((r) => setTimeout(r, 60 + Math.random() * 140))

export async function mockRequest(req: MockRequest): Promise<MockResponse> {
  await ensureSeeded()
  await latency()
  const method = req.method.toLowerCase()
  const path = req.path.split("?")[0]
  const matchesPath = compile().filter((c) => c.regex.test(path))
  const hit = matchesPath.find((c) => c.route.def.method === method)
  if (!hit) {
    return {
      status: 404,
      json: { error: { code: "not_found", message: `Route ${req.method.toUpperCase()} ${path} not found` } },
    }
  }
  const values = hit.regex.exec(path)!.slice(1)
  const params = Object.fromEntries(hit.keys.map((k, i) => [k, decodeURIComponent(values[i])]))
  try {
    // Round-trip through JSON so handlers never share object references with the caller.
    const body = req.body === undefined ? undefined : JSON.parse(JSON.stringify(req.body))
    const out = await executeRoute(hit.route.def, { params, query: req.query ?? {}, body, headers: req.headers })
    if ("file" in out) return { status: 200, text: out.file.content }
    if ("json" in out) return { status: out.status, json: JSON.parse(JSON.stringify(out.json)) }
    return { status: 204 }
  } catch (err) {
    try {
      return errorOutput(err)
    } catch {
      console.error("[mock-api]", err)
      return { status: 500, json: { error: { code: "internal_error", message: "Something went wrong" } } }
    }
  }
}

/**
 * Wipes the in-browser database and the session, then reloads the page; the demo workspace is
 * seeded again on the first request.
 */
export function resetMockDatabase() {
  suspendPersistence()
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith(MOCK_DB_PREFIX) || key === "selleasy-session") window.localStorage.removeItem(key)
  }
  window.location.reload()
}
