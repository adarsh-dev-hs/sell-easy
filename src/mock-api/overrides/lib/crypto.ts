// Browser replacement for backend/src/lib/crypto.ts (mock data mode).
// NOT real cryptography — the demo stores nothing sensitive. Same exported API as the server.
import { randomToken } from "./ids"

const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
const fromB64 = (s: string) => decodeURIComponent(escape(atob(s)))

export const encrypt = (plain: string) => `mock.${toB64(plain)}`

export const decrypt = (payload: string) => fromB64(payload.replace(/^mock\./, ""))

/** Deterministic 64-hex digest (two FNV-1a passes) — stands in for SHA-256 in the browser. */
export function sha256(value: string) {
  let out = ""
  for (let pass = 0; pass < 8; pass++) {
    let h = 0x811c9dc5 ^ pass
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    out += (h >>> 0).toString(16).padStart(8, "0")
  }
  return out
}

export const mask = (secret: string) => `••••••••${secret.slice(-4)}`

export const randomSecret = (prefix: string, length = 32) => prefix + randomToken(length)
