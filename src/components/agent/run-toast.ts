"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { AccountRef, AgentRun } from "@/lib/types"

const STATUS_TEXT: Record<AgentRun["status"], string> = {
  completed: "Agent run completed",
  awaiting_approval: "Agent drafted outreach — awaiting approval",
  failed: "Agent run failed",
  skipped: "Agent evaluated signal — no playbook matched",
}

/** Any run shape returned by the API (plain `RunRecord` or `AgentRunRecord` with an expanded account). */
export type ToastableRun = AgentRun & { account?: AccountRef | null }

export interface RunToastOptions {
  /** Account name to show when the run payload doesn't include an expanded `account`. */
  accountName?: string
}

/**
 * Returns a function that shows a toast describing an agent run (or a queued signal when `run` is null).
 * `context` is a short prefix such as "Signal ingested" or the signal title.
 */
export function useRunToast() {
  const router = useRouter()
  return useCallback(
    (run: ToastableRun | null | undefined, context?: string, opts: RunToastOptions = {}) => {
      if (!run) {
        toast.info(context ? `${context} — queued` : "Signal queued", {
          description: "Autopilot is off. Process pending signals to run the agent.",
        })
        return
      }
      const accountName = run.account?.name ?? opts.accountName
      const scoreText =
        run.scoreBefore !== undefined && run.scoreAfter !== undefined ? `score ${run.scoreBefore} → ${run.scoreAfter}` : ""
      const description = [context, accountName, scoreText].filter(Boolean).join(" · ")
      const toastOpts = {
        description,
        action: { label: "View run", onClick: () => router.push(`/agent?run=${run.id}`) },
      }
      if (run.status === "failed") toast.error(STATUS_TEXT[run.status], toastOpts)
      else if (run.status === "skipped") toast.info(STATUS_TEXT[run.status], toastOpts)
      else if (run.status === "awaiting_approval") toast.warning(STATUS_TEXT[run.status], toastOpts)
      else toast.success(STATUS_TEXT[run.status], toastOpts)
    },
    [router],
  )
}
