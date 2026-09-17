"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { AlertCircleIcon, CheckIcon, RotateCcwIcon, SaveIcon, SigmaIcon, Undo2Icon } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CompanyAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { ScoreBar, TierBadge } from "@/components/shared/score"
import { SignalIcon } from "@/components/shared/status"
import { COUNTRIES, FUNDING_STAGES, INDUSTRIES, SIGNAL_LABELS, TECHNOLOGIES } from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import { defaultIcp } from "@/lib/mock-data"
import { scoreAccount } from "@/lib/scoring"
import { useStore } from "@/lib/store"
import type { IcpConfig, SignalType, Tier } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIGNAL_TYPES = Object.keys(SIGNAL_LABELS) as SignalType[]
const TIERS: Tier[] = ["A", "B", "C", "D"]

const tierChart = {
  current: { label: "Current", color: "var(--chart-2)" },
  draft: { label: "Draft", color: "var(--chart-1)" },
} satisfies ChartConfig

const comparable = (c: IcpConfig) => JSON.stringify({ ...c, updatedAt: undefined })

function ChipSelect({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              on
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {on && <CheckIcon className="size-3" />}
            {o}
          </button>
        )
      })}
    </div>
  )
}

function SelectionHeader({ label, count, total, onAll, onNone }: { label: string; count: number; total: number; onAll: () => void; onNone: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <FieldLabel>
        {label}{" "}
        <span className="font-normal text-muted-foreground">
          ({count}/{total})
        </span>
      </FieldLabel>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="xs" onClick={onAll}>
          All
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={onNone}>
          None
        </Button>
      </div>
    </div>
  )
}

function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  display,
  icon,
  description,
}: {
  label: React.ReactNode
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  display?: React.ReactNode
  icon?: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <FieldLabel>{label}</FieldLabel>
        </div>
        <span className="text-sm font-medium tabular-nums">{display ?? value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}

export default function ScoringPage() {
  const icp = useStore((s) => s.icp)
  const accounts = useStore((s) => s.accounts)
  const signals = useStore((s) => s.signals)
  const updateIcp = useStore((s) => s.updateIcp)

  const [draft, setDraft] = useState<IcpConfig>(icp)
  const patch = (p: Partial<IcpConfig>) => setDraft((d) => ({ ...d, ...p }))

  const dirty = comparable(draft) !== comparable(icp)
  const isDefault = comparable(draft) === comparable(defaultIcp(draft.updatedAt))

  const errors = useMemo(() => {
    const e: string[] = []
    const t = draft.tierThresholds
    if (!(t.A > t.B && t.B > t.C)) e.push("Tier thresholds must be strictly descending (A > B > C).")
    if (t.C <= 0) e.push("Tier C threshold must be greater than 0.")
    if (draft.employeeMin < 0 || draft.employeeMax < 0) e.push("Employee counts can't be negative.")
    if (draft.employeeMin > draft.employeeMax) e.push("Minimum employees must be ≤ maximum employees.")
    if (draft.revenueMin < 0) e.push("Minimum revenue can't be negative.")
    if (draft.industries.length === 0) e.push("Select at least one industry.")
    if (draft.intentDecayDays < 1) e.push("Intent half-life must be at least 1 day.")
    return e
  }, [draft])

  const preview = useMemo(() => {
    const pool = accounts.filter((a) => !a.duplicateOf)
    const rows = pool.map((a) => {
      const sc = scoreAccount(a, signals, draft)
      return { account: a, ...sc, delta: sc.score - a.score, tierChanged: sc.tier !== a.tier }
    })
    const distribution = TIERS.map((t) => ({
      tier: `Tier ${t}`,
      current: pool.filter((a) => a.tier === t).length,
      draft: rows.filter((r) => r.tier === t).length,
    }))
    const top = [...rows].sort((a, b) => b.score - a.score).slice(0, 10)
    const tierChanges = rows.filter((r) => r.tierChanged).length
    const scoreChanges = rows.filter((r) => r.delta !== 0).length
    const promoted = rows.filter((r) => r.tierChanged && r.tier < r.account.tier).length
    const avgDraft = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0
    const avgCurrent = pool.length ? Math.round(pool.reduce((s, a) => s + a.score, 0) / pool.length) : 0
    return { distribution, top, tierChanges, scoreChanges, promoted, demoted: tierChanges - promoted, avgDraft, avgCurrent, total: rows.length }
  }, [accounts, signals, draft])

  const save = () => {
    if (errors.length) return
    const changed = updateIcp(draft)
    toast.success("ICP saved & accounts re-scored", {
      description: `${changed} account${changed === 1 ? "" : "s"} changed tier/score`,
    })
  }

  const discard = () => {
    setDraft(icp)
    toast("Changes discarded")
  }

  const resetDefaults = () => {
    setDraft(defaultIcp(new Date().toISOString()))
    toast("Draft reset to defaults", { description: "Save to apply the default configuration." })
  }

  const setThreshold = (k: keyof IcpConfig["tierThresholds"], v: number) =>
    patch({ tierThresholds: { ...draft.tierThresholds, [k]: v } })

  const numberInput = (v: string) => (v === "" ? 0 : Number(v))

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            ICP & Scoring
            {dirty && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                Unsaved changes
              </Badge>
            )}
          </span>
        }
        description={`Define your ideal customer profile and how fit and intent combine into a score. Last saved ${timeAgo(icp.updatedAt)}.`}
        actions={
          <>
            <ConfirmDialog
              title="Reset draft to defaults?"
              description="Your draft will be replaced by the default ICP configuration. Nothing is applied until you save."
              confirmLabel="Reset draft"
              destructive={false}
              onConfirm={resetDefaults}
              trigger={
                <Button variant="ghost" disabled={isDefault}>
                  <RotateCcwIcon /> Reset to defaults
                </Button>
              }
            />
            <Button variant="outline" onClick={discard} disabled={!dirty}>
              <Undo2Icon /> Discard
            </Button>
            <Button onClick={save} disabled={!dirty || errors.length > 0}>
              <SaveIcon /> Save & re-score
            </Button>
          </>
        }
      />

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Fix these before saving</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {/* Firmographic fit */}
          <Card>
            <CardHeader>
              <CardTitle>Firmographic fit</CardTitle>
              <CardDescription>
                Which companies look like your best customers. Fit is scored out of 100: industry 25, size 20, geography 15,
                revenue 15, tech stack 15 (5 per match), funding 10.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <SelectionHeader
                    label="Industries"
                    count={draft.industries.length}
                    total={INDUSTRIES.length}
                    onAll={() => patch({ industries: [...INDUSTRIES] })}
                    onNone={() => patch({ industries: [] })}
                  />
                  <ChipSelect options={INDUSTRIES} value={draft.industries} onChange={(industries) => patch({ industries })} />
                </Field>
                <Field>
                  <SelectionHeader
                    label="Countries"
                    count={draft.countries.length}
                    total={COUNTRIES.length}
                    onAll={() => patch({ countries: [...COUNTRIES] })}
                    onNone={() => patch({ countries: [] })}
                  />
                  <ChipSelect options={COUNTRIES} value={draft.countries} onChange={(countries) => patch({ countries })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="emp-min">Min employees</FieldLabel>
                    <Input
                      id="emp-min"
                      type="number"
                      min={0}
                      value={draft.employeeMin}
                      aria-invalid={draft.employeeMin > draft.employeeMax}
                      onChange={(e) => patch({ employeeMin: numberInput(e.target.value) })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="emp-max">Max employees</FieldLabel>
                    <Input
                      id="emp-max"
                      type="number"
                      min={0}
                      value={draft.employeeMax}
                      aria-invalid={draft.employeeMin > draft.employeeMax}
                      onChange={(e) => patch({ employeeMax: numberInput(e.target.value) })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rev-min">Min revenue ($M)</FieldLabel>
                    <Input
                      id="rev-min"
                      type="number"
                      min={0}
                      step={0.5}
                      value={draft.revenueMin / 1_000_000}
                      onChange={(e) => patch({ revenueMin: Math.round(numberInput(e.target.value) * 1_000_000) })}
                    />
                  </Field>
                </div>
                <FieldDescription className="-mt-3">
                  Accounts within 50%–150% of the size range get partial credit (8 of 20 points).
                </FieldDescription>
                <Field>
                  <SelectionHeader
                    label="Technologies"
                    count={draft.technologies.length}
                    total={TECHNOLOGIES.length}
                    onAll={() => patch({ technologies: [...TECHNOLOGIES] })}
                    onNone={() => patch({ technologies: [] })}
                  />
                  <ChipSelect
                    options={TECHNOLOGIES}
                    value={draft.technologies}
                    onChange={(technologies) => patch({ technologies })}
                  />
                </Field>
                <Field>
                  <SelectionHeader
                    label="Funding stages"
                    count={draft.fundingStages.length}
                    total={FUNDING_STAGES.length}
                    onAll={() => patch({ fundingStages: [...FUNDING_STAGES] })}
                    onNone={() => patch({ fundingStages: [] })}
                  />
                  <ChipSelect
                    options={FUNDING_STAGES}
                    value={draft.fundingStages}
                    onChange={(fundingStages) => patch({ fundingStages })}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Weights */}
          <Card>
            <CardHeader>
              <CardTitle>Weights</CardTitle>
              <CardDescription>Balance fit against intent and tune how much each signal type matters.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <SliderField
                  label="Fit vs intent"
                  value={draft.fitWeight}
                  onChange={(fitWeight) => patch({ fitWeight })}
                  display={`Fit ${draft.fitWeight}% / Intent ${100 - draft.fitWeight}%`}
                  description="Higher fit weight favors accounts that match your ICP; higher intent favors accounts showing recent buying activity."
                />
                <SliderField
                  label="Intent decay half-life"
                  value={draft.intentDecayDays}
                  min={1}
                  max={60}
                  onChange={(intentDecayDays) => patch({ intentDecayDays })}
                  display={`${draft.intentDecayDays} day${draft.intentDecayDays === 1 ? "" : "s"}`}
                  description={`A signal loses half its value every ${draft.intentDecayDays} days and is ignored after ${draft.intentDecayDays * 3} days.`}
                />
                <Separator />
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Signal weights</h3>
                  <p className="text-sm text-muted-foreground">Multiplier applied to each signal&apos;s strength (0 = ignore).</p>
                </div>
                <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {SIGNAL_TYPES.map((t) => (
                    <SliderField
                      key={t}
                      icon={<SignalIcon type={t} className="size-6 [&_svg]:size-3.5" />}
                      label={SIGNAL_LABELS[t]}
                      value={draft.signalWeights[t] ?? 50}
                      onChange={(v) => patch({ signalWeights: { ...draft.signalWeights, [t]: v } })}
                    />
                  ))}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Tiers */}
          <Card>
            <CardHeader>
              <CardTitle>Tier thresholds</CardTitle>
              <CardDescription>Minimum combined score for each tier. Anything below Tier C is Tier D.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {(["A", "B", "C"] as const).map((k) => {
                const t = draft.tierThresholds
                const bad = k === "A" ? t.A <= t.B : k === "B" ? t.B >= t.A || t.B <= t.C : t.C >= t.B || t.C <= 0
                return (
                  <Field key={k} data-invalid={bad || undefined}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TierBadge tier={k} />
                        <span className="text-sm text-muted-foreground">score ≥</span>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-7 w-20 text-right"
                        value={t[k]}
                        aria-invalid={bad}
                        onChange={(e) => setThreshold(k, Math.max(0, Math.min(100, numberInput(e.target.value))))}
                      />
                    </div>
                    <Slider value={[t[k]]} min={0} max={100} step={1} onValueChange={([v]) => setThreshold(k, v)} />
                  </Field>
                )
              })}
              <div className="flex h-3 overflow-hidden rounded-full text-[10px]">
                {(() => {
                  const t = draft.tierThresholds
                  const segs = [
                    { tier: "D", w: Math.max(0, t.C), cls: "bg-muted-foreground/30" },
                    { tier: "C", w: Math.max(0, t.B - t.C), cls: "bg-amber-500/70" },
                    { tier: "B", w: Math.max(0, t.A - t.B), cls: "bg-sky-500/70" },
                    { tier: "A", w: Math.max(0, 100 - t.A), cls: "bg-emerald-500/70" },
                  ]
                  return segs.map((s) => (
                    <div key={s.tier} className={s.cls} style={{ width: `${s.w}%` }} title={`Tier ${s.tier}`} />
                  ))
                })()}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>100</span>
              </div>
            </CardContent>
          </Card>

          {/* Explainer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SigmaIcon className="size-4" /> How scoring works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border bg-muted/50 p-3 font-mono text-xs text-foreground">
                score = fit × {(draft.fitWeight / 100).toFixed(2)} + intent × {(1 - draft.fitWeight / 100).toFixed(2)}
                <br />
                intent = min(100, Σ strength × weight(type) × 0.5^(age / {draft.intentDecayDays}d) × 0.45)
              </div>
              <p>
                <span className="font-medium text-foreground">Fit</span> (0–100) measures how closely an account matches the
                firmographic profile above.
              </p>
              <p>
                <span className="font-medium text-foreground">Intent</span> (0–100) is the time-decayed, weighted sum of the
                account&apos;s recent signals — a signal loses half its value every half-life and is dropped after three.
              </p>
              <p>
                The combined score maps to a tier, which the{" "}
                <Link href="/agent?tab=playbooks" className="text-primary hover:underline">
                  orchestration agent&apos;s playbooks
                </Link>{" "}
                use to decide what to do when a new signal arrives.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Live preview */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>
                {preview.total} accounts re-scored with the {dirty ? "draft" : "saved"} config
              </CardDescription>
              {dirty && (
                <CardAction>
                  <Badge variant="secondary">Draft</Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-2">
                  <div className="text-lg font-semibold tabular-nums">{preview.tierChanges}</div>
                  <div className="text-xs text-muted-foreground">tier changes</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-lg font-semibold tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">↑{preview.promoted}</span>{" "}
                    <span className="text-rose-600 dark:text-rose-400">↓{preview.demoted}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">promoted / demoted</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-lg font-semibold tabular-nums">
                    {preview.avgDraft}
                    <span
                      className={cn(
                        "ml-1 text-xs",
                        preview.avgDraft > preview.avgCurrent && "text-emerald-600 dark:text-emerald-400",
                        preview.avgDraft < preview.avgCurrent && "text-rose-600 dark:text-rose-400",
                        preview.avgDraft === preview.avgCurrent && "text-muted-foreground",
                      )}
                    >
                      {preview.avgDraft - preview.avgCurrent >= 0 ? "+" : ""}
                      {preview.avgDraft - preview.avgCurrent}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">avg score</div>
                </div>
              </div>
              <ChartContainer config={tierChart} className="h-48 w-full">
                <BarChart data={preview.distribution} margin={{ left: -20, right: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="tier" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="current" fill="var(--color-current)" radius={4} />
                  <Bar dataKey="draft" fill="var(--color-draft)" radius={4} />
                </BarChart>
              </ChartContainer>
              {preview.scoreChanges > 0 && (
                <p className="text-xs text-muted-foreground">
                  {preview.scoreChanges} account{preview.scoreChanges === 1 ? "" : "s"} would get a different score
                  {dirty ? "" : " (intent decays over time — save to refresh stored scores)"}.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 10 accounts</CardTitle>
              <CardDescription>Ranked by draft score</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Account</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead className="pr-4 text-right">Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.top.map((r) => (
                    <TableRow key={r.account.id}>
                      <TableCell className="max-w-44 pl-4">
                        <Link href={`/accounts/${r.account.id}`} className="flex items-center gap-2 hover:underline">
                          <CompanyAvatar name={r.account.name} className="size-6 text-[10px]" />
                          <span className="truncate font-medium">{r.account.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ScoreBar value={r.score} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-xs font-medium tabular-nums",
                          r.delta > 0 && "text-emerald-600 dark:text-emerald-400",
                          r.delta < 0 && "text-rose-600 dark:text-rose-400",
                          r.delta === 0 && "text-muted-foreground",
                        )}
                      >
                        {r.delta > 0 ? `+${r.delta}` : r.delta === 0 ? "—" : r.delta}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.tierChanged && (
                            <span className="text-xs text-muted-foreground line-through">{r.account.tier}</span>
                          )}
                          <TierBadge tier={r.tier} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
