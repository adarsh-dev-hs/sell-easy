"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import type { AgentRun } from "@/lib/types"

const STATUS_TEXT: Record<AgentRun["status"], string> = {
  completed: "Agent run completed",
  awaiting_approval: "Agent drafted outreach — awaiting approval",
  failed: "Agent run failed",
  skipped: "Agent evaluated signal — no playbook matched",
}

/** Returns a function that shows a toast describing an agent run (or a queued signal). */
export function useRunToast() {
  const router = useRouter()
  return useCallback(
    (run: AgentRun | null, context?: string) => {
      if (!run) {
        toast.info(context ? `${context} — queued` : "Signal queued", {
          description: "Autopilot is off. Process pending signals to run the agent.",
        })
        return
      }
      const account = useStore.getState().accounts.find((a) => a.id === run.accountId)
      const scoreText =
        run.scoreBefore !== undefined && run.scoreAfter !== undefined ? `score ${run.scoreBefore} → ${run.scoreAfter}` : ""
      const description = [context, account?.name, scoreText].filter(Boolean).join(" · ")
      const opts = {
        description,
        action: { label: "View run", onClick: () => router.push(`/agent?run=${run.id}`) },
      }
      if (run.status === "failed") toast.error(STATUS_TEXT[run.status], opts)
      else if (run.status === "skipped") toast.info(STATUS_TEXT[run.status], opts)
      else if (run.status === "awaiting_approval") toast.warning(STATUS_TEXT[run.status], opts)
      else toast.success(STATUS_TEXT[run.status], opts)
    },
    [router],
  )
}
