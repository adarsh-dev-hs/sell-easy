import { format } from "date-fns"
import type { Deal, DealStage } from "@/lib/types"

export const isClosed = (stage: DealStage) => stage === "closed_won" || stage === "closed_lost"

export const currentTime = () => Date.now()

export const isOverdue = (deal: Pick<Deal, "stage" | "closeDate">, nowMs: number) =>
  !isClosed(deal.stage) && new Date(deal.closeDate).getTime() < nowMs

export const isAgentSourced = (source: string) => source.startsWith("Agent")

/** ISO string -> value for <input type="date"> */
export const toDateInput = (iso?: string) => (iso ? format(new Date(iso), "yyyy-MM-dd") : "")

/** <input type="date"> value -> ISO string (noon local time to avoid TZ day shifts) */
export const fromDateInput = (value: string) => new Date(`${value}T12:00:00`).toISOString()
