"use client"

import { useMemo } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ArrowRightIcon,
  BotIcon,
  Building2Icon,
  CalendarCheckIcon,
  DollarSignIcon,
  FlameIcon,
  RadioTowerIcon,
  UploadIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { CompanyAvatar } from "@/components/shared/avatars"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { QueryError } from "@/components/shared/query-state"
import { ScoreBar, TierBadge } from "@/components/shared/score"
import { StatCard } from "@/components/shared/stat-card"
import { SignalIcon, StatusBadge } from "@/components/shared/status"
import { useCurrentUser, useDashboard } from "@/lib/api"
import { SIGNAL_LABELS } from "@/lib/constants"
import { currency, timeAgo } from "@/lib/format"

const signalChart = {
  signals: { label: "Signals", color: "var(--chart-1)" },
  agentActions: { label: "Agent actions", color: "var(--chart-2)" },
} satisfies ChartConfig

const pipelineChart = {
  amount: { label: "Pipeline", color: "var(--chart-1)" },
} satisfies ChartConfig

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"
}

export default function DashboardPage() {
  const user = useCurrentUser()
  const { data, isLoading, error, refetch } = useDashboard()

  const activity = useMemo(
    () => (data?.activity30d ?? []).map((d) => ({ ...d, label: format(parseISO(d.day), "MMM d") })),
    [data],
  )

  const header = (
    <PageHeader
      title={`Good ${greeting()}, ${user.name.split(" ")[0]}`}
      description="Here's what your agent and your pipeline have been up to."
      actions={
        !!data?.stats.pendingDrafts && (
          <Button asChild variant="outline">
            <Link href="/agent?tab=approvals">
              <BotIcon /> Review {data.stats.pendingDrafts} drafts
            </Link>
          </Button>
        )
      }
    />
  )

  if (error) {
    return (
      <>
        {header}
        <QueryError error={error} onRetry={refetch} />
      </>
    )
  }

  if (isLoading || !data) {
    return (
      <>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-7">
          <Skeleton className="h-80 rounded-xl lg:col-span-4" />
          <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        </div>
      </>
    )
  }

  const { stats } = data
  const isEmpty = !data.hotAccounts.length && !data.latestSignals.length

  return (
    <>
      {header}

      {isEmpty && (
        <EmptyState
          icon={UploadIcon}
          title="Your workspace is empty"
          description="Import your accounts and contacts, connect your signal vendors, and the agent will start scoring and routing."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/accounts?import=1">Import accounts</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/integrations">Connect integrations</Link>
              </Button>
            </div>
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={currency(stats.pipeline)} icon={DollarSignIcon} hint={`${currency(stats.weighted)} weighted · ${stats.openDeals} deals`} />
        <StatCard label="Tier A accounts" value={stats.hotAccounts} icon={FlameIcon} hint="Best fit + intent" />
        <StatCard label="Signals (7d)" value={stats.signals7d} icon={RadioTowerIcon} hint="Ingested in the last week" />
        <StatCard label="Positive replies" value={stats.positiveReplies} icon={CalendarCheckIcon} hint={`${currency(stats.won)} closed won`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Signal activity</CardTitle>
            <CardDescription>Signals ingested vs. agent actions over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={signalChart} className="h-64 w-full">
              <AreaChart data={activity} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id="fillSignals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-signals)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-signals)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <Area dataKey="signals" type="monotone" stroke="var(--color-signals)" fill="url(#fillSignals)" strokeWidth={2} />
                <Area dataKey="agentActions" type="monotone" stroke="var(--color-agentActions)" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Open pipeline by stage</CardTitle>
            <CardDescription>
              {currency(stats.pipeline)} across {stats.openDeals} deals
            </CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/pipeline">
                  Pipeline <ArrowRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pipelineChart} className="h-64 w-full">
              <BarChart data={data.pipelineByStage} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={84} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => currency(Number(v))} hideLabel={false} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Hottest accounts</CardTitle>
            <CardDescription>Ranked by live intent score</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/accounts">
                  All <ArrowRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data.hotAccounts.length && <p className="text-sm text-muted-foreground">No accounts yet.</p>}
            {data.hotAccounts.map((a) => (
              <Link key={a.id} href={`/accounts/${a.id}`} className="-mx-2 flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60">
                <CompanyAvatar name={a.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {a.industry} · {a.employees.toLocaleString()} emp
                  </div>
                </div>
                <TierBadge tier={a.tier} />
                <ScoreBar value={a.intentScore} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest signals</CardTitle>
            <CardDescription>From your connected intent sources</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/signals">
                  All <ArrowRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data.latestSignals.length && <p className="text-sm text-muted-foreground">No signals yet.</p>}
            {data.latestSignals.map((s) => (
              <Link key={s.id} href={`/accounts/${s.accountId}`} className="-mx-2 flex gap-3 rounded-lg p-2 hover:bg-muted/60">
                <SignalIcon type={s.type} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.accountName} · {SIGNAL_LABELS[s.type]} · {timeAgo(s.occurredAt)}
                  </div>
                </div>
                {!s.processed && <Badge variant="secondary">New</Badge>}
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent activity</CardTitle>
            <CardDescription>What the orchestration agent did</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/agent">
                  All <ArrowRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data.latestRuns.length && <p className="text-sm text-muted-foreground">No agent runs yet.</p>}
            {data.latestRuns.map((r) => (
              <Link key={r.id} href={`/agent?run=${r.id}`} className="-mx-2 flex items-start gap-3 rounded-lg p-2 hover:bg-muted/60">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.accountName}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.trigger}</div>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
