import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TIER_STYLES } from "@/lib/constants"
import type { Tier } from "@/lib/types"
import { cn } from "@/lib/utils"

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-semibold", TIER_STYLES[tier], className)}>
      Tier {tier}
    </Badge>
  )
}

export function scoreColor(value: number) {
  if (value >= 70) return "bg-emerald-500"
  if (value >= 50) return "bg-sky-500"
  if (value >= 35) return "bg-amber-500"
  return "bg-muted-foreground/40"
}

export function ScoreBar({ value, className, showValue = true }: { value: number; className?: string; showValue?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", scoreColor(value))} style={{ width: `${value}%` }} />
      </div>
      {showValue && <span className="w-7 text-right text-xs font-medium tabular-nums">{value}</span>}
    </div>
  )
}

export function ScoreCell({ score, fit, intent }: { score: number; fit: number; intent: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex">
          <ScoreBar value={score} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        Fit {fit} · Intent {intent}
      </TooltipContent>
    </Tooltip>
  )
}
