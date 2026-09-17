"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format, subDays } from "date-fns"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ArrowRightIcon,
  BotIcon,
  Building2Icon,
  CalendarCheckIcon,
  DollarSignIcon,
  FlameIcon,
  RadioTowerIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { CompanyAvatar } from "@/components/shared/avatars"
import { PageHeader } from "@/components/shared/page-header"
import { ScoreBar, TierBadge } from "@/components/shared/score"
import { StatCard } from "@/components/shared/stat-card"
import { SignalIcon, StatusBadge } from "@/components/shared/status"
import { DEAL_STAGES, SIGNAL_LABELS } from "@/lib/constants"
import { currency, timeAgo } from "@/lib/format"
import { useCurrentUser, useLookup, useStore } from "@/lib/store"

const signalChart = {
  signals: { label: "Signals", color: "var(--chart-1)" },
  processed: { label: "Agent actions", color: "var(--chart-2)" },
} satisfies ChartConfig

const pipelineChart = {
  amount: { label: "Pipeline", color: "var(--chart-1)" },
} satisfies ChartConfig

export default function DashboardPage() {
  const user = useCurrentUser()
  const accounts = useStore((s) => s.accounts)
  const signals = useStore((s) => s.signals)
  const deals = useStore((s) => s.deals)
  const runs = useStore((s) => s.runs)
  const drafts = useStore((s) => s.drafts)
  const inbox = useStore((s) => s.inbox)
  const lookup = useLookup()
  const [now] = useState(() => Date.now())

  const stats = useMemo(() => {
    const open = deals.filter((d) => !d.stage.startsWith("closed"))
    const weekAgo = now - 7 * 86_400_000
    return {
      pipeline: open.reduce((s, d) => s + d.amount, 0),
      weighted: open.reduce((s, d) => s + (d.amount * d.probability) / 100, 0),
      won: deals.filter((d) => d.stage === "closed_won").reduce((s, d) => s + d.amount, 0),
      hot: accounts.filter((a) => a.tier === "A" && !a.duplicateOf).length,
      signals7d: signals.filter((s) => new Date(s.occurredAt).getTime() > weekAgo).length,
      meetings: inbox.filter((m) => m.sentiment === "positive").length,
      pendingDrafts: drafts.filter((d) => d.status === "pending").length,
    }
  }, [accounts, signals, deals, inbox, drafts, now])

  const activity = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), 29 - i), "MMM d"))
    const map = new Map(days.map((d) => [d, { day: d, signals: 0, processed: 0 }]))
    for (const s of signals) {
      const row = map.get(format(new Date(s.occurredAt), "MMM d"))
      if (row) row.signals++
    }
    for (const r of runs) {
      const row = map.get(format(new Date(r.startedAt), "MMM d"))
      if (row && r.status !== "skipped") row.processed++
    }
    return [...map.values()]
  }, [signals, runs])

  const pipelineByStage = useMemo(
    () =>
      DEAL_STAGES.filter((s) => !s.id.startsWith("closed")).map((s) => ({
        stage: s.label,
        amount: deals.filter((d) => d.stage === s.id).reduce((sum, d) => sum + d.amount, 0),
      })),
    [deals],
  )

  const hotAccounts = useMemo(
    () => accounts.filter((a) => !a.duplicateOf).sort((a, b) => b.intentScore - a.intentScore).slice(0, 6),
    [accounts],
  )

  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`}
        description="Here's what your agent and your pipeline have been up to."
        actions={
          stats.pendingDrafts > 0 && (
            <Button asChild variant="outline">
              <Link href="/agent?tab=approvals">
                <BotIcon /> Review {stats.pendingDrafts} drafts
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={currency(stats.pipeline)} icon={DollarSignIcon} delta={12} hint={`${currency(stats.weighted)} weighted`} />
        <StatCard label="Tier A accounts" value={stats.hot} icon={FlameIcon} delta={8} hint="vs last week" />
        <StatCard label="Signals (7d)" value={stats.signals7d} icon={RadioTowerIcon} delta={23} hint="across 6 sources" />
        <StatCard label="Positive replies" value={stats.meetings} icon={CalendarCheckIcon} delta={-4} hint={`${currency(stats.won)} closed won`} />
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
                <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <Area dataKey="signals" type="monotone" stroke="var(--color-signals)" fill="url(#fillSignals)" strokeWidth={2} />
                <Area dataKey="processed" type="monotone" stroke="var(--color-processed)" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Open pipeline by stage</CardTitle>
            <CardDescription>{currency(stats.pipeline)} across {deals.filter((d) => !d.stage.startsWith("closed")).length} deals</CardDescription>
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
              <BarChart data={pipelineByStage} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false} width={84} />
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
            {hotAccounts.map((a) => (
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
            <CardDescription>From Bombora, RB2B, Trigify and more</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/signals">
                  All <ArrowRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {signals.slice(0, 6).map((s) => (
              <Link key={s.id} href={`/accounts/${s.accountId}`} className="-mx-2 flex gap-3 rounded-lg p-2 hover:bg-muted/60">
                <SignalIcon type={s.type} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {lookup.account(s.accountId)?.name} · {SIGNAL_LABELS[s.type]} · {timeAgo(s.occurredAt)}
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
            {runs.slice(0, 6).map((r) => (
              <Link key={r.id} href={`/agent?run=${r.id}`} className="-mx-2 flex items-start gap-3 rounded-lg p-2 hover:bg-muted/60">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{lookup.account(r.accountId)?.name}</div>
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
