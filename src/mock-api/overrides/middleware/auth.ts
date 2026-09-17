// Browser replacement for backend/src/middleware/auth.ts (mock data mode).
// Tokens are unsigned base64 JSON — fine for an in-browser demo, never for production.
import { db } from "../db"
import type { Role } from "../domain/types"
import { sha256 } from "../lib/crypto"
import { forbidden, unauthorized } from "../lib/errors"
import { nowIso } from "../lib/ids"
import type { AuthContext } from "../lib/roles"

export { assertRole, atLeast, type AuthContext } from "../lib/roles"

interface TokenPayload {
  sub: string
  org: string
  role: Role
  exp: number
}

const WEEK_MS = 7 * 86_400_000

export function signToken(user: { id: string; orgId: string; role: Role }) {
  const payload: TokenPayload = { sub: user.id, org: user.orgId, role: user.role, exp: Date.now() + WEEK_MS }
  return `mock.${btoa(JSON.stringify(payload))}`
}

export async function authenticateBearer(header: string | undefined): Promise<AuthContext> {
  if (!header?.startsWith("Bearer ")) throw unauthorized()
  let payload: TokenPayload
  try {
    payload = JSON.parse(atob(header.slice(7).replace(/^mock\./, ""))) as TokenPayload
  } catch {
    throw unauthorized("Session expired or invalid token")
  }
  if (!payload.exp || payload.exp < Date.now()) throw unauthorized("Session expired or invalid token")
  const user = await db.users.get(payload.org, payload.sub)
  if (!user || user.status !== "active") throw unauthorized("User no longer has access")
  return { userId: user.id, orgId: user.orgId, role: user.role, via: "jwt" }
}

export async function authenticateApiKey(key: string | undefined, scope?: string): Promise<AuthContext> {
  if (!key) throw unauthorized("Missing x-api-key header")
  const record = await db.apiKeys.findGlobal({ hash: sha256(key), revoked: false })
  if (!record) throw unauthorized("Invalid API key")
  if (scope && !record.scopes.includes(scope)) throw forbidden(`API key lacks the "${scope}" scope`)
  await db.apiKeys.update(record.orgId, record.id, { lastUsedAt: nowIso() })
  return { userId: record.createdBy, orgId: record.orgId, role: "member", via: "apiKey", scopes: record.scopes }
}

export function authenticateRequest(mode: "user" | "apiKey", headers: Record<string, string | undefined>, scope?: string) {
  if (mode === "apiKey") {
    return authenticateApiKey(headers["x-api-key"] ?? headers.authorization?.replace(/^Bearer /, ""), scope)
  }
  return authenticateBearer(headers.authorization)
}
