"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts"
import {
  BotIcon,
  CalendarCheckIcon,
  DollarSignIcon,
  DownloadIcon,
  Loader2Icon,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OwnerLabel } from "@/components/shared/avatars"
import { PageHeader } from "@/components/shared/page-header"
import { QueryError } from "@/components/shared/query-state"
import { TierBadge } from "@/components/shared/score"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status"
import { type AnalyticsOverview, downloadText, errorMessage, fetchDealsCsv, useAnalyticsOverview } from "@/lib/api"
import { currency, percent } from "@/lib/format"

const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 180 days" },
]

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
  const [range, setRange] = useState("90")
  const days = Number(range)
  const { data, error, isError, refetch } = useAnalyticsOverview(days)
  const [exporting, setExporting] = useState(false)

  const exportCsv = async () => {
    setExporting(true)
    try {
      const csv = await fetchDealsCsv(days)
      downloadText(csv, `selleasy-deals-${days}d-${format(new Date(), "yyyy-MM-dd")}.csv`)
      const rows = Math.max(0, csv.trim().split("\n").length - 1)
      toast.success(`Exported ${rows} deal${rows === 1 ? "" : "s"}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const rangeLabel = RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? ""

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
            <Button variant="outline" onClick={exportCsv} disabled={exporting}>
              {exporting ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />} Export CSV
            </Button>
          </>
        }
      />

      {data ? (
        <AnalyticsContent data={data} rangeLabel={rangeLabel} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : (
        <AnalyticsSkeleton />
      )}
    </>
  )
}

function AnalyticsContent({ data, rangeLabel }: { data: AnalyticsOverview; rangeLabel: string }) {
  const { stats, attribution, tiers, sequences: sequenceRows, reps } = data
  const weekly = useMemo(
    () => data.pipelineByWeek.map((w) => ({ ...w, week: format(parseISO(w.week), "MMM d") })),
    [data.pipelineByWeek],
  )
  const funnel = useMemo(
    () =>
      data.funnel.map((s, i) => ({
        ...s,
        label: i === 0 ? `${s.count}` : `${s.count} · ${percent(s.conversion, 0)}`,
      })),
    [data.funnel],
  )
  const { sourceMix, sourceConfig } = useMemo(() => {
    const config: ChartConfig = { value: { label: "Signals" } }
    const mix = data.sourceMix.map(({ source, count }, i) => {
      const key = `src${i}`
      config[key] = { label: source, color: `var(--chart-${(i % 5) + 1})` }
      return { key, name: source, value: count, fill: `var(--color-${key})` }
    })
    return { sourceMix: mix, sourceConfig: config }
  }, [data.sourceMix])

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Pipeline created"
          value={currency(stats.pipelineCreated)}
          icon={DollarSignIcon}
          hint={`${stats.dealsCreated} deals, ${rangeLabel}`}
        />
        <StatCard
          label="Revenue won"
          value={currency(stats.revenueWon)}
          icon={TrophyIcon}
          hint={`${stats.dealsWon} deals closed`}
        />
        <StatCard
          label="Reply rate"
          value={percent(stats.replyRate)}
          icon={MessageSquareReplyIcon}
          hint={`${stats.replies} replies across sequences`}
        />
        <StatCard label="Meetings booked" value={stats.meetings} icon={CalendarCheckIcon} hint="From outreach sequences" />
        <StatCard
          label="Agent-sourced pipeline"
          value={percent(stats.agentPct, 0)}
          icon={BotIcon}
          hint={`${currency(stats.agentPipeline)} opened by the agent`}
        />
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
                <ChartTooltip
                  cursor={{ fillOpacity: 0.4 }}
                  content={<ChartTooltipContent formatter={currencyRow(createdChart)} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="other" stackId="a" fill="var(--color-other)" stroke="var(--card)" strokeWidth={1} maxBarSize={36} />
                <Bar
                  dataKey="sequence"
                  stackId="a"
                  fill="var(--color-sequence)"
                  stroke="var(--card)"
                  strokeWidth={1}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="agent"
                  stackId="a"
                  fill="var(--color-agent)"
                  stroke="var(--card)"
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
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
                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={116} />
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
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        >
                          1
                        </Badge>
                      ) : (
                        <span className="pl-2 text-muted-foreground tabular-nums">{i + 1}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <OwnerLabel user={r.user} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.accountsOwned}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(r.openPipeline)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{currency(r.wonAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.dealsWon}</TableCell>
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
              {stats.signals} signals ingested {rangeLabel}
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

function AnalyticsSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[106px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-96 rounded-xl lg:col-span-3" />
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <Skeleton className="h-96 rounded-xl lg:col-span-3" />
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
