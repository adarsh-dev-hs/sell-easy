"use client"

import { useMemo, useState } from "react"
import { CoinsIcon, PlugIcon, PlugZapIcon, SearchIcon, TriangleAlertIcon, ZapIcon } from "lucide-react"
import { ConfigureSheet } from "@/components/integrations/configure-sheet"
import { ConnectDialog } from "@/components/integrations/connect-dialog"
import { IntegrationCard } from "@/components/integrations/integration-card"
import { WaterfallCard } from "@/components/integrations/waterfall-card"
import { useDebounced } from "@/components/integrations/use-debounced"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { QueryError } from "@/components/shared/query-state"
import { StatCard } from "@/components/shared/stat-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useIntegrations, useIntegrationStats } from "@/lib/api"
import { INTEGRATION_CATEGORY_LABELS } from "@/lib/constants"
import { number } from "@/lib/format"
import type { IntegrationCategory } from "@/lib/types"

const CATEGORIES = Object.keys(INTEGRATION_CATEGORY_LABELS) as IntegrationCategory[]

export default function IntegrationsPage() {
  const [category, setCategory] = useState<IntegrationCategory | "all">("all")
  const [query, setQuery] = useState("")
  const [connectedOnly, setConnectedOnly] = useState(false)
  const [connectId, setConnectId] = useState<string | null>(null)
  const [configureId, setConfigureId] = useState<string | null>(null)
  const q = useDebounced(query.trim(), 250)

  // Full catalog for category counts and dialog targets; the grid itself is filtered server-side.
  const all = useIntegrations()
  const filtered = useIntegrations({
    category: category === "all" ? undefined : [category],
    connected: connectedOnly ? true : undefined,
    q: q || undefined,
  })
  const statsQuery = useIntegrationStats()
  const integrations = useMemo(() => all.data ?? [], [all.data])
  const stats = statsQuery.data

  const connectTarget = integrations.find((i) => i.id === connectId) ?? null
  const configureTarget = integrations.find((i) => i.id === configureId && i.connected) ?? null
  const errored = useMemo(() => {
    const ids = new Set(stats?.errorIds ?? [])
    return integrations.filter((i) => ids.has(i.id))
  }, [integrations, stats?.errorIds])

  const groups = useMemo(() => {
    const items = filtered.data ?? []
    return CATEGORIES.map((c) => ({ category: c, items: items.filter((i) => i.category === c) })).filter((g) => g.items.length > 0)
  }, [filtered.data])

  const countByCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of integrations) m.set(i.category, (m.get(i.category) ?? 0) + 1)
    return m
  }, [integrations])

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Third-party vendors that feed enrichment, signals, outreach and CRM data into SellEasy."
      />

      {errored.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>
            {errored.length} integration{errored.length > 1 ? "s" : ""} need attention
          </AlertTitle>
          <AlertDescription>
            <p>Syncs are failing with authentication errors. Reconnect to resume data flow.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {errored.map((i) => (
                <Button key={i.id} size="sm" variant="outline" onClick={() => setConnectId(i.id)}>
                  <PlugZapIcon /> Reconnect {i.name}
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {statsQuery.isError ? (
        <QueryError error={statsQuery.error} onRetry={() => statsQuery.refetch()} title="Couldn't load integration stats" />
      ) : !stats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Connected" value={`${stats.connected} / ${stats.total}`} icon={PlugIcon} hint="vendors feeding SellEasy" />
          <StatCard
            label="Errors"
            value={stats.errors}
            icon={TriangleAlertIcon}
            hint={stats.errors ? errored.map((i) => i.name).join(", ") || `${stats.errors} failing` : "All syncs healthy"}
          />
          <StatCard
            label="Credits used (month)"
            value={number(stats.creditsUsed)}
            icon={CoinsIcon}
            hint={`+ ${number(stats.tokensUsed)}k LLM tokens`}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <InputGroup className="sm:max-w-xs">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput placeholder="Search integrations…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </InputGroup>
              <div className="flex items-center gap-2">
                <Switch id="connected-only" checked={connectedOnly} onCheckedChange={setConnectedOnly} />
                <Label htmlFor="connected-only">Connected only</Label>
              </div>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={category}
              onValueChange={(v) => v && setCategory(v as IntegrationCategory | "all")}
              className="flex-wrap"
            >
              <ToggleGroupItem value="all">All ({all.data ? integrations.length : "…"})</ToggleGroupItem>
              {CATEGORIES.map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {INTEGRATION_CATEGORY_LABELS[c]} ({countByCategory.get(c) ?? 0})
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {filtered.isError ? (
            <QueryError error={filtered.error} onRetry={() => filtered.refetch()} />
          ) : filtered.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, n) => (
                <Skeleton key={n} className="h-56 rounded-xl" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              icon={PlugIcon}
              title="No integrations match"
              description="Try a different category or clear your search."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("")
                    setCategory("all")
                    setConnectedOnly(false)
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            groups.map((g) => (
              <section key={g.category} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-medium">{INTEGRATION_CATEGORY_LABELS[g.category]}</h2>
                  <span className="text-xs text-muted-foreground">
                    {g.items.filter((i) => i.connected).length} of {g.items.length} connected
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {g.items.map((i) => (
                    <IntegrationCard
                      key={i.id}
                      integration={i}
                      onConnect={() => setConnectId(i.id)}
                      onConfigure={() => setConfigureId(i.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <WaterfallCard />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ZapIcon className="size-4" /> How data flows
              </CardTitle>
              <CardDescription>Each vendor feeds one internal service.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Enrichment & contacts</span> update accounts in the Entity service.
              </p>
              <p>
                <span className="font-medium text-foreground">Intent vendors</span> push signals that trigger the orchestration agent.
              </p>
              <p>
                <span className="font-medium text-foreground">CRM sync</span> mirrors deals and writes back scores.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConnectDialog integration={connectTarget} onOpenChange={(o) => !o && setConnectId(null)} />
      <ConfigureSheet integration={configureTarget} onOpenChange={(o) => !o && setConfigureId(null)} />
    </>
  )
}
