"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { STEP_CHANNEL_LABELS } from "@/lib/constants"
import { number, percent } from "@/lib/format"
import type { Sequence, SequenceStep } from "@/lib/types"
import { StepChannelIcon, rate } from "./channel"

const funnelChart = {
  value: { label: "Contacts", color: "var(--chart-1)" },
} satisfies ChartConfig

type StepRow = {
  step: SequenceStep
  index: number
  reached: number
  primary: number | null // sent / completed
  primaryLabel: string
  opened: number | null
  replied: number | null
}

/** Split `total` across `weights` so the parts sum exactly to `total`. */
function apportion(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (!sum || !total) return weights.map(() => 0)
  const raw = weights.map((w) => (total * w) / sum)
  const out = raw.map(Math.floor)
  let rest = total - out.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (rest <= 0) break
    out[i]++
    rest--
  }
  return out
}

function perStep(sequence: Sequence): StepRow[] {
  const { stats, steps } = sequence
  const emailIdx = steps.map((s, i) => (s.channel === "email" ? i : -1)).filter((i) => i >= 0)
  const sendW = emailIdx.map((_, k) => 0.72 ** k)
  const sent = apportion(stats.sent, sendW)
  const opened = apportion(stats.opened, sendW.map((w, k) => w * 0.9 ** k))
  const replied = apportion(stats.replied, sendW.map((w, k) => w * 0.85 ** k))

  let emailK = 0
  return steps.map((step, index) => {
    const reached = Math.round(stats.enrolled * 0.86 ** index)
    const base = { step, index, reached }
    switch (step.channel) {
      case "email": {
        const k = emailK++
        return {
          ...base,
          primary: sent[k],
          primaryLabel: "sent",
          opened: Math.min(opened[k], sent[k]),
          replied: Math.min(replied[k], sent[k]),
        }
      }
      case "linkedin_connect":
        return { ...base, primary: Math.round(reached * 0.92), primaryLabel: "requests", opened: Math.round(reached * 0.38), replied: null }
      case "linkedin_message":
        return {
          ...base,
          primary: Math.round(reached * 0.4),
          primaryLabel: "messages",
          opened: Math.round(reached * 0.31),
          replied: Math.round(reached * 0.06),
        }
      case "call":
        return { ...base, primary: Math.round(reached * 0.7), primaryLabel: "dials", opened: Math.round(reached * 0.18), replied: Math.round(reached * 0.05) }
      default:
        return { ...base, primary: null, primaryLabel: "", opened: null, replied: null }
    }
  })
}

const SECONDARY_LABEL: Partial<Record<SequenceStep["channel"], string>> = {
  email: "opened",
  linkedin_connect: "accepted",
  linkedin_message: "seen",
  call: "connected",
}

export function SequencePerformance({ sequence }: { sequence: Sequence }) {
  const { stats } = sequence
  const funnel = useMemo(
    () => [
      { stage: "Enrolled", value: stats.enrolled },
      { stage: "Sent", value: stats.sent },
      { stage: "Opened", value: stats.opened },
      { stage: "Replied", value: stats.replied },
      { stage: "Meetings", value: stats.meetings },
    ],
    [stats],
  )
  const rows = useMemo(() => perStep(sequence), [sequence])

  const conversions = [
    { label: "Open rate", value: rate(stats.opened, stats.sent), hint: "opened / sent" },
    { label: "Reply rate", value: rate(stats.replied, stats.sent), hint: "replied / sent" },
    { label: "Meeting rate", value: rate(stats.meetings, stats.replied), hint: "meetings / replies" },
    { label: "Bounce rate", value: rate(stats.bounced, stats.sent), hint: "bounced / sent" },
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
                  <XAxis dataKey="stage" tickLine={false} axisLine={false} />
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
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                  No steps in this sequence.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.step.id}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <StepChannelIcon channel={r.step.channel} className="size-7" />
                    <div className="min-w-0">
                      <div className="font-medium">
                        Step {r.index + 1} · {STEP_CHANNEL_LABELS[r.step.channel]}
                      </div>
                      <div className="max-w-64 truncate text-xs text-muted-foreground">
                        Day {r.step.dayOffset}
                        {r.step.subject ? ` · ${r.step.subject}` : ""}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{number(r.reached)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.primary === null ? "—" : (
                    <>
                      {number(r.primary)} <span className="text-xs text-muted-foreground">{r.primaryLabel}</span>
                    </>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.opened === null ? "—" : (
                    <>
                      {number(r.opened)} <span className="text-xs text-muted-foreground">{SECONDARY_LABEL[r.step.channel]}</span>
                    </>
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
