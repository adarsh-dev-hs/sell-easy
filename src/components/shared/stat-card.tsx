import type { LucideIcon } from "lucide-react"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  className,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  delta?: number
  hint?: string
  className?: string
}) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="space-y-2 px-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          {Icon && <Icon className="size-4" />}
        </div>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {(delta !== undefined || hint) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {delta !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                )}
              >
                {delta >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
                {Math.abs(delta)}%
              </span>
            )}
            {hint && <span>{hint}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
