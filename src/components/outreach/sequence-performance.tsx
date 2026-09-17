"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { QueryError } from "@/components/shared/query-state"
import { type SequenceRecord, useSequencePerformance } from "@/lib/api"
import { STEP_CHANNEL_LABELS } from "@/lib/constants"
import { number, percent } from "@/lib/format"
import { StepChannelIcon, rate } from "./channel"

const funnelChart = {
  value: { label: "Contacts", color: "var(--chart-1)" },
} satisfies ChartConfig

export function SequencePerformance({ sequence }: { sequence: SequenceRecord }) {
  const perf = useSequencePerformance(sequence.id)

  if (perf.isError) return <QueryError error={perf.error} onRetry={() => perf.refetch()} title="Couldn't load performance" />

  if (perf.isPending) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const { stats, funnel, rates, steps } = perf.data
  const conversions = [
    { label: "Open rate", value: rates.openRate, hint: "opened / sent" },
    { label: "Reply rate", value: rates.replyRate, hint: "replied / sent" },
    { label: "Meeting rate", value: rates.meetingRate, hint: "meetings / replies" },
    { label: "Bounce rate", value: rates.bounceRate, hint: "bounced / sent" },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversion funnel</CardTitle>
            <CardDescription>From enrollment to booked meetings</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.enrolled + stats.sent === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No activity yet — enroll contacts and activate the sequence.
              </div>
            ) : (
              <ChartContainer config={funnelChart} className="h-64 w-full">
                <BarChart data={funnel} margin={{ top: 20, left: -12, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => number(Number(v))} />
                  <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent hideIndicator />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={56}>
                    <LabelList dataKey="value" position="top" className="fill-muted-foreground" fontSize={12} formatter={(v) => number(Number(v))} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversion rates</CardTitle>
            <CardDescription>Lifetime for this sequence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {conversions.map((c) => (
              <div key={c.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm">{c.label}</span>
                  <span className="text-lg font-semibold tabular-nums">{percent(c.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-(--chart-1)" style={{ width: `${Math.min(100, c.value)}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">{c.hint}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Per-step breakdown</CardTitle>
          <CardDescription>How each touch in the cadence performs</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Step</TableHead>
              <TableHead className="text-right">Reached</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Engaged</TableHead>
              <TableHead className="text-right">Replied</TableHead>
              <TableHead className="pr-4 text-right">Reply rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                  No steps in this sequence.
                </TableCell>
              </TableRow>
            )}
            {steps.map((r) => (
              <TableRow key={r.stepId}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <StepChannelIcon channel={r.channel} className="size-7" />
                    <div className="min-w-0">
                      <div className="font-medium">
                        Step {r.index + 1} · {STEP_CHANNEL_LABELS[r.channel]}
                      </div>
                      <div className="max-w-64 truncate text-xs text-muted-foreground">
                        Day {r.dayOffset}
                        {r.subject ? ` · ${r.subject}` : ""}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{number(r.reached)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.primary !== null ? (
                    <>
                      {number(r.primary)} <span className="text-xs text-muted-foreground">{r.primaryLabel}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.secondary !== null ? (
                    <>
                      {number(r.secondary)} <span className="text-xs text-muted-foreground">{r.secondaryLabel}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.replied === null ? "—" : number(r.replied)}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {r.replied === null || !r.primary ? "—" : percent(rate(r.replied, r.primary))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
