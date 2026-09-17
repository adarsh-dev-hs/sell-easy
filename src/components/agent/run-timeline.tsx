"use client"

import Link from "next/link"
import { CheckIcon, ClockIcon, MinusIcon, XIcon } from "lucide-react"
import { StatusBadge } from "@/components/shared/status"
import { dateTime } from "@/lib/format"
import type { AgentRun, AgentStep, PlaybookRule } from "@/lib/types"
import { cn } from "@/lib/utils"

const STEP_STYLES: Record<AgentStep["status"], { icon: typeof CheckIcon; className: string }> = {
  done: { icon: CheckIcon, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  pending: { icon: ClockIcon, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  skipped: { icon: MinusIcon, className: "bg-muted text-muted-foreground" },
  failed: { icon: XIcon, className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
}

export function StepTimeline({ steps, className }: { steps: AgentStep[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-4", className)}>
      {steps.map((step, i) => {
        const { icon: Icon, className: tone } = STEP_STYLES[step.status]
        return (
          <li key={i} className="relative flex gap-3">
            {i < steps.length - 1 && <span aria-hidden className="absolute top-7 bottom-[-1rem] left-3 w-px bg-border" />}
            <div className={cn("z-10 flex size-6 shrink-0 items-center justify-center rounded-full", tone)}>
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{step.label}</span>
                <StatusBadge status={step.status} className="h-4 px-1.5 text-[10px]" />
              </div>
              {step.detail && <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function ScoreDelta({ before, after }: { before?: number; after?: number }) {
  if (before === undefined || after === undefined) return <span className="text-muted-foreground">—</span>
  const d = after - before
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className="text-muted-foreground">{before}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-medium">{after}</span>
      <span
        className={cn(
          "text-xs font-medium",
          d > 0 && "text-emerald-600 dark:text-emerald-400",
          d < 0 && "text-rose-600 dark:text-rose-400",
          d === 0 && "text-muted-foreground",
        )}
      >
        {d > 0 ? `+${d}` : d === 0 ? "±0" : d}
      </span>
    </span>
  )
}

export const formatDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`)

/** Compact summary block for a run: header line + timeline. */
export function RunSummary({ run, rule, accountName }: { run: AgentRun; rule?: PlaybookRule; accountName?: string }) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/agent?run=${run.id}`} className="text-sm font-medium hover:underline">
            {rule?.name ?? "No playbook matched"}
          </Link>
          <div className="text-xs text-muted-foreground">
            {accountName ? `${accountName} · ` : ""}
            {dateTime(run.startedAt)} · {formatDuration(run.durationMs)}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <ScoreDelta before={run.scoreBefore} after={run.scoreAfter} />
          <StatusBadge status={run.status} />
        </div>
      </div>
      <StepTimeline steps={run.steps} />
    </div>
  )
}
