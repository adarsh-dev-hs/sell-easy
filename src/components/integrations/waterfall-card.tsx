"use client"

import { useMemo } from "react"
import { ArrowDownIcon, ArrowUpIcon, LayersIcon } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { INTEGRATION_CATEGORY_LABELS } from "@/lib/constants"
import { useStore } from "@/lib/store"
import { isWaterfallCandidate, waterfallRank } from "./config"
import { IntegrationTile } from "./integration-card"

export function WaterfallCard() {
  const integrations = useStore((s) => s.integrations)
  const updateIntegrationSettings = useStore((s) => s.updateIntegrationSettings)

  // The order is persisted on each integration's settings (`waterfallOrder`), so the
  // derived list is the single source of truth and survives reloads.
  const providers = useMemo(
    () =>
      integrations
        .filter(isWaterfallCandidate)
        .map((i, idx) => ({ i, idx }))
        .sort((a, b) => waterfallRank(a.i) - waterfallRank(b.i) || a.idx - b.idx)
        .map((x) => x.i),
    [integrations],
  )

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= providers.length) return
    const next = [...providers]
    ;[next[index], next[target]] = [next[target], next[index]]
    next.forEach((p, pos) => updateIntegrationSettings(p.id, { waterfallOrder: String(pos + 1) }))
    toast.success(`${providers[index].name} moved to position ${target + 1}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayersIcon className="size-4" /> Enrichment waterfall
        </CardTitle>
        <CardDescription>
          Try provider 1 → fall through to the next on a miss. Order providers by match rate and cost.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <EmptyState
            icon={LayersIcon}
            title="No waterfall providers"
            description="Connect an enrichment or contacts provider and enable “Use in waterfall”."
          />
        ) : (
          <ol className="space-y-2">
            {providers.map((p, idx) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border p-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                  {idx + 1}
                </span>
                <IntegrationTile integration={p} className="size-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {idx === 0 ? "Tried first" : `On miss from #${idx}`}
                  </div>
                </div>
                <Badge variant="outline" className="hidden font-normal sm:inline-flex">
                  {INTEGRATION_CATEGORY_LABELS[p.category]}
                </Badge>
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${p.name} up`} disabled={idx === 0} onClick={() => move(idx, -1)}>
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${p.name} down`}
                    disabled={idx === providers.length - 1}
                    onClick={() => move(idx, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
