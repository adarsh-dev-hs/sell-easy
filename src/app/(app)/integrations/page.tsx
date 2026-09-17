"use client"

import { useMemo, useState } from "react"
import { CoinsIcon, PlugIcon, PlugZapIcon, SearchIcon, TriangleAlertIcon, ZapIcon } from "lucide-react"
import { ConfigureSheet } from "@/components/integrations/configure-sheet"
import { ConnectDialog } from "@/components/integrations/connect-dialog"
import { IntegrationCard } from "@/components/integrations/integration-card"
import { WaterfallCard } from "@/components/integrations/waterfall-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { INTEGRATION_CATEGORY_LABELS } from "@/lib/constants"
import { number } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { IntegrationCategory } from "@/lib/types"

const CATEGORIES = Object.keys(INTEGRATION_CATEGORY_LABELS) as IntegrationCategory[]

export default function IntegrationsPage() {
  const integrations = useStore((s) => s.integrations)
  const [category, setCategory] = useState<IntegrationCategory | "all">("all")
  const [query, setQuery] = useState("")
  const [connectedOnly, setConnectedOnly] = useState(false)
  const [connectId, setConnectId] = useState<string | null>(null)
  const [configureId, setConfigureId] = useState<string | null>(null)

  const connectTarget = integrations.find((i) => i.id === connectId) ?? null
  const configureTarget = integrations.find((i) => i.id === configureId && i.connected) ?? null

  const stats = useMemo(() => {
    const connected = integrations.filter((i) => i.connected)
    const credits = connected.reduce((sum, i) => sum + (i.usage && i.usage.unit === "credits" ? i.usage.used : 0), 0)
    const tokens = connected.reduce((sum, i) => sum + (i.usage && i.usage.unit !== "credits" ? i.usage.used : 0), 0)
    return {
      connected: connected.length,
      errors: integrations.filter((i) => i.status === "error"),
      credits,
      tokens,
    }
  }, [integrations])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = integrations.filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (!connectedOnly || i.connected) &&
        (!q || `${i.name} ${i.description} ${i.feeds}`.toLowerCase().includes(q)),
    )
    return CATEGORIES.map((c) => ({ category: c, items: filtered.filter((i) => i.category === c) })).filter((g) => g.items.length > 0)
  }, [integrations, category, query, connectedOnly])

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

      {stats.errors.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>
            {stats.errors.length} integration{stats.errors.length > 1 ? "s" : ""} need attention
          </AlertTitle>
          <AlertDescription>
            <p>Syncs are failing with authentication errors. Reconnect to resume data flow.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {stats.errors.map((i) => (
                <Button key={i.id} size="sm" variant="outline" onClick={() => setConnectId(i.id)}>
                  <PlugZapIcon /> Reconnect {i.name}
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Connected" value={`${stats.connected} / ${integrations.length}`} icon={PlugIcon} hint="vendors feeding SellEasy" />
        <StatCard
          label="Errors"
          value={stats.errors.length}
          icon={TriangleAlertIcon}
          hint={stats.errors.length ? stats.errors.map((i) => i.name).join(", ") : "All syncs healthy"}
        />
        <StatCard label="Credits used (month)" value={number(stats.credits)} icon={CoinsIcon} hint={`+ ${number(stats.tokens)}k LLM tokens`} />
      </div>

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
              <ToggleGroupItem value="all">All ({integrations.length})</ToggleGroupItem>
              {CATEGORIES.map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {INTEGRATION_CATEGORY_LABELS[c]} ({countByCategory.get(c) ?? 0})
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {groups.length === 0 ? (
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
