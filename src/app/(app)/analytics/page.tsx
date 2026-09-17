"use client"

import { useMemo, useState } from "react"
import { eachWeekOfInterval, format, startOfWeek } from "date-fns"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts"
import {
  BotIcon,
  CalendarCheckIcon,
  DollarSignIcon,
  DownloadIcon,
  MessageSquareReplyIcon,
  TrophyIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OwnerLabel } from "@/components/shared/avatars"
import { PageHeader } from "@/components/shared/page-header"
import { TierBadge } from "@/components/shared/score"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status"
import { downloadCsv, toCsv } from "@/components/analytics/csv"
import { currentTime, isAgentSourced } from "@/components/pipeline/deal-utils"
import { DEAL_STAGE_LABEL, SIGNAL_LABELS } from "@/lib/constants"
import { currency, percent } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Signal, SignalType, Tier } from "@/lib/types"

const DAY = 86_400_000
const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 180 days" },
]
const TIERS: Tier[] = ["A", "B", "C", "D"]
const ENGAGED_STAGES = new Set(["engaged", "opportunity", "customer"])
const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0)
const time = (iso: string) => new Date(iso).getTime()

const createdChart = {
  agent: { label: "Agent-sourced", color: "var(--chart-1)" },
  sequence: { label: "Sequence reply", color: "var(--chart-2)" },
  other: { label: "Inbound / referral / manual", color: "var(--chart-3)" },
} satisfies ChartConfig

const attributionChart = {
  amount: { label: "Pipeline", color: "var(--chart-1)" },
} satisfies ChartConfig

const funnelChart = {
  count: { label: "Accounts", color: "var(--chart-1)" },
} satisfies ChartConfig

const tierChart = {
  pipeline: { label: "Pipeline created", color: "var(--chart-1)" },
  won: { label: "Won", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function AnalyticsPage() {
  const accounts = useStore((s) => s.accounts)
  const deals = useStore((s) => s.deals)
  const signals = useStore((s) => s.signals)
  const sequences = useStore((s) => s.sequences)
  const users = useStore((s) => s.users)
  const lookup = useLookup()

  const [nowMs] = useState(currentTime)
  const [range, setRange] = useState("90")
  const cutoff = nowMs - Number(range) * DAY

  const scope = useMemo(() => {
    const realAccounts = accounts.filter((a) => !a.duplicateOf)
    return {
      realAccounts,
      accountsInRange: realAccounts.filter((a) => time(a.createdAt) >= cutoff),
      dealsInRange: deals.filter((d) => time(d.createdAt) >= cutoff),
      wonInRange: deals.filter((d) => d.stage === "closed_won" && time(d.closeDate) >= cutoff),
      signalsInRange: signals.filter((s) => time(s.occurredAt) >= cutoff),
    }
  }, [accounts, deals, signals, cutoff])

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const created = scope.dealsInRange.reduce((s, d) => s + d.amount, 0)
    const agent = scope.dealsInRange.filter((d) => isAgentSourced(d.source)).reduce((s, d) => s + d.amount, 0)
    const totals = sequences.reduce(
      (t, q) => ({ sent: t.sent + q.stats.sent, replied: t.replied + q.stats.replied, meetings: t.meetings + q.stats.meetings }),
      { sent: 0, replied: 0, meetings: 0 },
    )
    return {
      created,
      createdCount: scope.dealsInRange.length,
      won: scope.wonInRange.reduce((s, d) => s + d.amount, 0),
      wonCount: scope.wonInRange.length,
      replyRate: ratio(totals.replied, totals.sent),
      replied: totals.replied,
      meetings: totals.meetings,
      agentPct: ratio(agent, created),
      agent,
    }
  }, [scope, sequences])

  // ---------- a) Pipeline created by week ----------
  const weekly = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: cutoff, end: nowMs })
    const map = new Map(weeks.map((w) => [w.getTime(), { week: format(w, "MMM d"), agent: 0, sequence: 0, other: 0 }]))
    for (const d of scope.dealsInRange) {
      const row = map.get(startOfWeek(new Date(d.createdAt)).getTime())
      if (!row) continue
      if (isAgentSourced(d.source)) row.agent += d.amount
      else if (d.source === "Sequence reply") row.sequence += d.amount
      else row.other += d.amount
    }
    return [...map.values()]
  }, [scope, cutoff, nowMs])

  // ---------- b) Attribution by signal type ----------
  const attribution = useMemo(() => {
    const byAccount = new Map<string, Signal[]>()
    for (const s of signals) {
      const list = byAccount.get(s.accountId)
      if (list) list.push(s)
      else byAccount.set(s.accountId, [s])
    }
    return (Object.keys(SIGNAL_LABELS) as SignalType[])
      .map((type) => {
        const touched = scope.dealsInRange.filter((d) =>
          (byAccount.get(d.accountId) ?? []).some((s) => s.type === type && s.occurredAt < d.createdAt),
        )
        return { type: SIGNAL_LABELS[type], amount: touched.reduce((s, d) => s + d.amount, 0), deals: touched.length }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [signals, scope])

  // ---------- c) Funnel ----------
  const funnel = useMemo(() => {
    const pool = scope.accountsInRange
    const withDeal = new Set(deals.map((d) => d.accountId))
    const withWon = new Set(deals.filter((d) => d.stage === "closed_won").map((d) => d.accountId))
    const steps = [
      { step: "Accounts", count: pool.length },
      { step: "Engaged", count: pool.filter((a) => ENGAGED_STAGES.has(a.stage) || withDeal.has(a.id)).length },
      { step: "Opportunities", count: pool.filter((a) => withDeal.has(a.id)).length },
      { step: "Won", count: pool.filter((a) => withWon.has(a.id)).length },
    ]
    return steps.map((s, i) => ({
      ...s,
      conversion: i === 0 ? 100 : ratio(s.count, steps[i - 1].count),
      label: i === 0 ? `${s.count}` : `${s.count} · ${percent(ratio(s.count, steps[i - 1].count), 0)}`,
    }))
  }, [scope, deals])

  // ---------- d) Tier performance ----------
  const tiers = useMemo(
    () =>
      TIERS.map((tier) => {
        const ids = new Set(scope.realAccounts.filter((a) => a.tier === tier).map((a) => a.id))
        const tierDeals = scope.dealsInRange.filter((d) => ids.has(d.accountId))
        const won = tierDeals.filter((d) => d.stage === "closed_won")
        const lost = tierDeals.filter((d) => d.stage === "closed_lost")
        const wonAmount = won.reduce((s, d) => s + d.amount, 0)
        return {
          tier,
          accounts: ids.size,
          deals: tierDeals.length,
          winRate: ratio(won.length, won.length + lost.length),
          closed: won.length + lost.length,
          avgDeal: won.length ? wonAmount / won.length : 0,
          pipeline: tierDeals.reduce((s, d) => s + d.amount, 0),
          won: wonAmount,
        }
      }),
    [scope],
  )

  // ---------- e) Sequences ----------
  const sequenceRows = useMemo(
    () =>
      [...sequences]
        .map((q) => ({
          ...q,
          openRate: ratio(q.stats.opened, q.stats.sent),
          replyRate: ratio(q.stats.replied, q.stats.sent),
          meetingRate: ratio(q.stats.meetings, q.stats.replied),
        }))
        .sort((a, b) => b.replyRate - a.replyRate),
    [sequences],
  )

  // ---------- f) Reps ----------
  const reps = useMemo(
    () =>
      users
        .filter((u) => u.role !== "viewer")
        .map((u) => {
          const won = scope.wonInRange.filter((d) => d.ownerId === u.id)
          return {
            user: u,
            accounts: scope.realAccounts.filter((a) => a.ownerId === u.id).length,
            open: deals.filter((d) => d.ownerId === u.id && !d.stage.startsWith("closed")).reduce((s, d) => s + d.amount, 0),
            wonAmount: won.reduce((s, d) => s + d.amount, 0),
            wonCount: won.length,
          }
        })
        .sort((a, b) => b.wonAmount - a.wonAmount || b.open - a.open),
    [users, scope, deals],
  )

  // ---------- g) Signal source mix ----------
  const { sourceMix, sourceConfig } = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of scope.signalsInRange) counts.set(s.source, (counts.get(s.source) ?? 0) + 1)
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 4)
    const rest = sorted.slice(4).reduce((s, [, n]) => s + n, 0)
    const entries = rest ? [...top, ["Other", rest] as [string, number]] : top
    const config: ChartConfig = { value: { label: "Signals" } }
    const data = entries.map(([name, value], i) => {
      const key = `src${i}`
      config[key] = { label: name, color: `var(--chart-${i + 1})` }
      return { key, name, value, fill: `var(--color-${key})` }
    })
    return { sourceMix: data, sourceConfig: config }
  }, [scope])

  const exportCsv = () => {
    const rows = scope.dealsInRange.map((d) => [
      d.id,
      d.name,
      lookup.account(d.accountId)?.name ?? "",
      lookup.account(d.accountId)?.tier ?? "",
      DEAL_STAGE_LABEL[d.stage],
      d.amount,
      d.probability,
      Math.round((d.amount * d.probability) / 100),
      d.closeDate.slice(0, 10),
      lookup.user(d.ownerId)?.name ?? "",
      d.source,
      d.crmId ?? "",
      d.syncedAt ? "yes" : "no",
      d.createdAt.slice(0, 10),
      d.updatedAt.slice(0, 10),
    ])
    const csv = toCsv(
      ["Deal ID", "Deal", "Account", "Tier", "Stage", "Amount", "Probability", "Weighted", "Close date", "Owner", "Source", "CRM ID", "Synced", "Created", "Updated"],
      rows,
    )
    downloadCsv(`selleasy-deals-${range}d-${format(nowMs, "yyyy-MM-dd")}.csv`, csv)
    toast.success(`Exported ${rows.length} deals`)
  }

  const rangeLabel = RANGES.find((r) => r.value === range)?.label.toLowerCase()

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Attribution, funnel and team performance across your agentic GTM motion."
        actions={
          <>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-40" aria-label="Date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv}>
              <DownloadIcon /> Export CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Pipeline created" value={currency(kpis.created)} icon={DollarSignIcon} hint={`${kpis.createdCount} deals, ${rangeLabel}`} />
        <StatCard label="Revenue won" value={currency(kpis.won)} icon={TrophyIcon} hint={`${kpis.wonCount} deals closed`} />
        <StatCard label="Reply rate" value={percent(kpis.replyRate)} icon={MessageSquareReplyIcon} hint={`${kpis.replied} replies across sequences`} />
        <StatCard label="Meetings booked" value={kpis.meetings} icon={CalendarCheckIcon} hint="From outreach sequences" />
        <StatCard label="Agent-sourced pipeline" value={percent(kpis.agentPct, 0)} icon={BotIcon} hint={`${currency(kpis.agent)} opened by the agent`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Pipeline created</CardTitle>
            <CardDescription>Weekly new pipeline by source, {rangeLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={createdChart} className="h-72 w-full">
              <BarChart data={weekly} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => currency(Number(v))} />
                <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent formatter={currencyRow(createdChart)} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="other" stackId="a" fill="var(--color-other)" stroke="var(--card)" strokeWidth={1} maxBarSize={36} />
                <Bar dataKey="sequence" stackId="a" fill="var(--color-sequence)" stroke="var(--card)" strokeWidth={1} maxBarSize={36} />
                <Bar dataKey="agent" stackId="a" fill="var(--color-agent)" stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attribution by signal</CardTitle>
            <CardDescription>Pipeline on accounts that showed each signal before the deal opened</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={attributionChart} className="h-72 w-full">
              <BarChart data={attribution} layout="vertical" margin={{ left: 0, right: 48 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="type" type="category" tickLine={false} axisLine={false} width={116} />
                <ChartTooltip
                  cursor={{ fillOpacity: 0.4 }}
                  content={
                    <ChartTooltipContent
                      formatter={(v, _n, item) => (
                        <span className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{(item.payload as { deals: number }).deals} deals</span>
                          <span className="font-mono font-medium tabular-nums">{currency(Number(v))}</span>
                        </span>
                      )}
                    />
                  }
                />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={4} maxBarSize={20}>
                  <LabelList
                    dataKey="amount"
                    position="right"
                    className="fill-muted-foreground"
                    fontSize={11}
                    formatter={(v: unknown) => (Number(v) ? currency(Number(v)) : "")}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
            <CardDescription>Accounts added {rangeLabel} · label shows step conversion</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={funnelChart} className="h-72 w-full">
              <BarChart data={funnel} margin={{ top: 24, left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="step" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <ChartTooltip
                  cursor={{ fillOpacity: 0.4 }}
                  content={
                    <ChartTooltipContent
                      formatter={(v, _n, item) => (
                        <span className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">
                            {percent((item.payload as { conversion: number }).conversion, 0)} of previous
                          </span>
                          <span className="font-mono font-medium tabular-nums">{Number(v)}</span>
                        </span>
                      )}
                    />
                  }
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  {funnel.map((_, i) => (
                    <Cell key={i} fill="var(--color-count)" fillOpacity={1 - i * 0.18} />
                  ))}
                  <LabelList dataKey="label" position="top" className="fill-foreground" fontSize={12} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Tier performance</CardTitle>
            <CardDescription>How ICP tiers convert — deals created {rangeLabel}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Accounts</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                  <TableHead className="text-right">Avg deal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((t) => (
                  <TableRow key={t.tier}>
                    <TableCell>
                      <TierBadge tier={t.tier} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.accounts}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.deals}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.closed ? percent(t.winRate, 0) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.avgDeal ? currency(t.avgDeal) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ChartContainer config={tierChart} className="h-56 w-full">
              <BarChart data={tiers} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="tier" tickLine={false} axisLine={false} tickFormatter={(v) => `Tier ${v}`} />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => currency(Number(v))} />
                <ChartTooltip
                  cursor={{ fillOpacity: 0.4 }}
                  content={<ChartTooltipContent labelFormatter={(v) => `Tier ${v}`} formatter={currencyRow(tierChart)} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="pipeline" fill="var(--color-pipeline)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="won" fill="var(--color-won)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sequence performance</CardTitle>
          <CardDescription>All-time engagement for each outreach sequence, ranked by reply rate</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sequence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead>Open rate</TableHead>
                <TableHead>Reply rate</TableHead>
                <TableHead>Meetings / reply</TableHead>
                <TableHead className="text-right">Meetings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequenceRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                    No sequences yet.
                  </TableCell>
                </TableRow>
              )}
              {sequenceRows.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-64 truncate font-medium">{q.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={q.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{q.stats.enrolled.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{q.stats.sent.toLocaleString()}</TableCell>
                  <TableCell>
                    <RateCell value={q.openRate} />
                  </TableCell>
                  <TableCell>
                    <RateCell value={q.replyRate} />
                  </TableCell>
                  <TableCell>
                    <RateCell value={q.meetingRate} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{q.stats.meetings}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Rep leaderboard</CardTitle>
            <CardDescription>Ranked by revenue won, {rangeLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-right">Accounts</TableHead>
                  <TableHead className="text-right">Open pipeline</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Deals won</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps.map((r, i) => (
                  <TableRow key={r.user.id}>
                    <TableCell>
                      {i === 0 && r.wonAmount > 0 ? (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          1
                        </Badge>
                      ) : (
                        <span className="pl-2 text-muted-foreground tabular-nums">{i + 1}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <OwnerLabel user={r.user} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.accounts}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(r.open)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{currency(r.wonAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.wonCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Signal source mix</CardTitle>
            <CardDescription>
              {scope.signalsInRange.length} signals ingested {rangeLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sourceMix.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No signals in this range.</div>
            ) : (
              <ChartContainer config={sourceConfig} className="mx-auto aspect-square h-72 max-w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                  <Pie
                    data={sourceMix}
                    dataKey="value"
                    nameKey="key"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {sourceMix.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="key" />} className="flex-wrap gap-2" />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function currencyRow(config: ChartConfig) {
  function CurrencyRow(value: unknown, name: unknown, item: { color?: string }) {
    const label = config[String(name)]?.label ?? String(name)
    return (
      <span className="flex w-full items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: item.color }} />
        <span className="text-muted-foreground">{label}</span>
        <span className="ml-auto pl-4 font-mono font-medium tabular-nums">{currency(Number(value))}</span>
      </span>
    )
  }
  return CurrencyRow
}

function RateCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={Math.min(100, value)} className="h-1.5 w-16" />
      <span className="w-12 text-xs tabular-nums">{percent(value)}</span>
    </div>
  )
}
