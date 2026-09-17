// Browser replacement for backend/src/lib/logger.ts (pino-compatible subset).
type Log = (objOrMsg: unknown, msg?: string) => void

const make =
  (fn: (...args: unknown[]) => void): Log =>
  (objOrMsg, msg) =>
    msg === undefined ? fn("[mock-api]", objOrMsg) : fn("[mock-api]", msg, objOrMsg)

export const logger = {
  trace: (() => undefined) as Log,
  debug: (() => undefined) as Log,
  info: (() => undefined) as Log,
  warn: make(console.warn),
  error: make(console.error),
  fatal: make(console.error),
}
