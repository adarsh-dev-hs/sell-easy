"use client"

import { ArrowRightIcon, Loader2Icon, PlugZapIcon, RefreshCwIcon, Settings2Icon } from "lucide-react"
import { StatusBadge } from "@/components/shared/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { canWrite, isAdmin, useCurrentUser, useSyncIntegration } from "@/lib/api"
import { initials, timeAgo } from "@/lib/format"
import type { Integration } from "@/lib/types"
import { cn } from "@/lib/utils"
import { TILE_COLORS } from "./config"

export function IntegrationTile({ integration, className }: { integration: Pick<Integration, "name" | "category">; className?: string }) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
        TILE_COLORS[integration.category],
        className,
      )}
    >
      {initials(integration.name.replace(/[()]/g, ""))}
    </div>
  )
}

export function UsageBar({ usage }: { usage: NonNullable<Integration["usage"]> }) {
  const pct = usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Monthly usage</span>
        <span className="tabular-nums">
          {usage.used.toLocaleString()} / {usage.limit.toLocaleString()} {usage.unit}
        </span>
      </div>
      <Progress value={pct} className={cn(pct >= 90 && "[&>[data-slot=progress-indicator]]:bg-destructive")} />
    </div>
  )
}

export function IntegrationCard({
  integration: i,
  onConnect,
  onConfigure,
}: {
  integration: Integration
  onConnect: () => void
  onConfigure: () => void
}) {
  const user = useCurrentUser()
  const admin = isAdmin(user.role)
  const syncIntegration = useSyncIntegration()
  const syncing = i.status === "syncing" || syncIntegration.isPending

  const sync = () => syncIntegration.mutate(i.id)

  return (
    <Card className={cn(i.status === "error" && "ring-destructive/40")}>
      <CardContent className="flex-1 space-y-3">
        <div className="flex items-start gap-3">
          <IntegrationTile integration={i} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate font-medium">{i.name}</div>
              <StatusBadge status={i.status} label={syncing && !i.connected ? "Connecting" : undefined} />
            </div>
            <div className="text-xs text-muted-foreground">
              {i.connected ? `Last sync ${timeAgo(i.lastSyncAt)}` : "Not connected"}
            </div>
          </div>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{i.description}</p>
        <Badge variant="secondary" className="gap-1 font-normal">
          Feeds <ArrowRightIcon className="size-3" /> {i.feeds}
        </Badge>
        {i.connected && i.usage && <UsageBar usage={i.usage} />}
      </CardContent>
      <CardFooter className="gap-2">
        {!i.connected ? (
          <Button
            size="sm"
            className="w-full"
            onClick={onConnect}
            disabled={syncing || !admin}
            title={admin ? undefined : "Only owners and admins can connect integrations"}
          >
            {syncing ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />}
            {syncing ? "Connecting…" : "Connect"}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" className="flex-1" onClick={onConfigure}>
              <Settings2Icon /> Configure
            </Button>
            {i.status === "error" ? (
              <Button size="sm" variant="destructive" className="flex-1" onClick={onConnect} disabled={!admin}>
                <PlugZapIcon /> Reconnect
              </Button>
            ) : (
              <Button size="sm" variant="secondary" className="flex-1" onClick={sync} disabled={syncing || !canWrite(user.role)}>
                <RefreshCwIcon className={cn(syncing && "animate-spin")} />
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  )
}
