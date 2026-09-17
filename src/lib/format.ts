import { formatDistanceToNowStrict, format } from "date-fns"

export const currency = (n: number, compact = true) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n)

export const number = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n)

export const percent = (n: number, digits = 1) => `${(Number.isFinite(n) ? n : 0).toFixed(digits)}%`

export const timeAgo = (iso?: string) =>
  iso ? `${formatDistanceToNowStrict(new Date(iso))} ago` : "—"

export const shortDate = (iso?: string) => (iso ? format(new Date(iso), "MMM d, yyyy") : "—")

export const dateTime = (iso?: string) => (iso ? format(new Date(iso), "MMM d, h:mm a") : "—")

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`

export const fullName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`
