"use client"

import { ArrowDownIcon, ArrowUpIcon, LayersIcon } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryError } from "@/components/shared/query-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isAdmin, useCurrentUser, useSaveWaterfall, useWaterfall } from "@/lib/api"
import { INTEGRATION_CATEGORY_LABELS } from "@/lib/constants"
import { IntegrationTile } from "./integration-card"

export function WaterfallCard() {
  const user = useCurrentUser()
  const canEdit = isAdmin(user.role)
  const waterfall = useWaterfall()
  const save = useSaveWaterfall()

  // The org-level order lives on the server; while a save is in flight show the requested order.
  const fetched = waterfall.data ?? []
  const pendingKeys = save.isPending ? save.variables : undefined
  const providers = pendingKeys
    ? [...fetched].sort((a, b) => pendingKeys.indexOf(a.key) - pendingKeys.indexOf(b.key))
    : fetched

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (!canEdit || save.isPending || target < 0 || target >= providers.length) return
    const next = providers.map((p) => p.key)
    ;[next[index], next[target]] = [next[target], next[index]]
    const moved = providers[index].name
    save.mutate(next, { onSuccess: () => toast.success(`${moved} moved to position ${target + 1}`) })
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
        {waterfall.isError ? (
          <QueryError error={waterfall.error} onRetry={() => waterfall.refetch()} />
        ) : waterfall.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            icon={LayersIcon}
            title="No waterfall providers"
            description="Connect an enrichment or contacts provider and enable “Use in waterfall”."
          />
        ) : (
          <ol className="space-y-2">
            {providers.map((p, idx) => (
              <li key={p.key} className="flex items-center gap-3 rounded-lg border p-2">
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
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${p.name} up`} disabled={!canEdit || save.isPending || idx === 0} onClick={() => move(idx, -1)}>
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${p.name} down`}
                    disabled={!canEdit || save.isPending || idx === providers.length - 1}
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
