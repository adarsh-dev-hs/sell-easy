"use client"

import { useState } from "react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { AlertCircleIcon, CheckIcon, Loader2Icon, RotateCcwIcon, SaveIcon, SigmaIcon, Undo2Icon } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDebounced } from "@/components/signals/use-debounced"
import { CompanyAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { QueryError } from "@/components/shared/query-state"
import { ScoreBar, TierBadge } from "@/components/shared/score"
import { SignalIcon } from "@/components/shared/status"
import {
  ApiError,
  type IcpInput,
  isAdmin,
  toIcpInput,
  useCurrentUser,
  useIcp,
  useIcpDefaults,
  useIcpPreview,
  useMeta,
  useSaveIcp,
} from "@/lib/api"
import { COUNTRIES, FUNDING_STAGES, INDUSTRIES, SIGNAL_LABELS, TECHNOLOGIES } from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import type { IcpConfig, SignalType } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIGNAL_TYPES = Object.keys(SIGNAL_LABELS) as SignalType[]

const tierChart = {
  current: { label: "Current", color: "var(--chart-2)" },
  draft: { label: "Draft", color: "var(--chart-1)" },
} satisfies ChartConfig

/** Order-insensitive serialization so drafts compare equal regardless of key order. */
function comparable(c: IcpInput) {
  const sortKeys = (v: unknown): unknown =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, sortKeys(x)]),
        )
      : v
  return JSON.stringify(sortKeys(c))
}

/** Client-side checks mirrored from the API so the user gets immediate feedback. */
function validate(draft: IcpInput) {
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
}

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
  const { data: icp, error, refetch } = useIcp()

  if (error) {
    return (
      <>
        <PageHeader title="ICP & Scoring" description="Define your ideal customer profile and how fit and intent combine into a score." />
        <QueryError error={error} onRetry={() => refetch()} title="Couldn't load the ICP" />
      </>
    )
  }
  if (!icp) return <ScoringSkeleton />
  // Re-key on every server change so the draft re-initializes from the saved config (e.g. after Save).
  return <IcpEditor key={icp.updatedAt} icp={icp} />
}

function ScoringSkeleton() {
  return (
    <>
      <PageHeader title="ICP & Scoring" description="Define your ideal customer profile and how fit and intent combine into a score." />
      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    </>
  )
}

function IcpEditor({ icp }: { icp: IcpConfig }) {
  const user = useCurrentUser()
  const admin = isAdmin(user.role)
  const { data: meta } = useMeta()
  const defaults = useIcpDefaults()
  const saveIcp = useSaveIcp()

  const industries = meta?.industries ?? INDUSTRIES
  const countries = meta?.countries ?? COUNTRIES
  const technologies = meta?.technologies ?? TECHNOLOGIES
  const fundingStages = meta?.fundingStages ?? FUNDING_STAGES

  const [saved] = useState(() => toIcpInput(icp))
  const [draft, setDraft] = useState<IcpInput>(saved)
  const patch = (p: Partial<IcpInput>) => {
    if (saveIcp.error) saveIcp.reset()
    setDraft((d) => ({ ...d, ...p }))
  }

  const dirty = comparable(draft) !== comparable(saved)
  const isDefault = !!defaults.data && comparable(draft) === comparable(toIcpInput(defaults.data))
  const errors = validate(draft)

  const serverErrors =
    saveIcp.error instanceof ApiError
      ? Object.entries(saveIcp.error.fieldErrors).flatMap(([field, msgs]) => msgs.map((m) => `${field}: ${m}`))
      : []

  // Live preview: debounce the draft, skip invalid configs, keep showing the previous result while fetching.
  const debouncedDraft = useDebounced(draft, 400)
  const preview = useIcpPreview(debouncedDraft, validate(debouncedDraft).length === 0)
  const p = preview.data
  const previewStale = preview.isFetching || debouncedDraft !== draft

  const save = () => {
    if (errors.length || !admin) return
    saveIcp.mutate(draft)
  }

  const discard = () => {
    saveIcp.reset()
    setDraft(saved)
    toast("Changes discarded")
  }

  const resetDefaults = () => {
    if (!defaults.data) return
    saveIcp.reset()
    setDraft(toIcpInput(defaults.data))
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
        description={`Define your ideal customer profile and how fit and intent combine into a score. Last saved ${timeAgo(icp.updatedAt)}.${admin ? "" : " Only workspace admins can save changes — edits here are a what-if preview."}`}
        actions={
          <>
            <ConfirmDialog
              title="Reset draft to defaults?"
              description="Your draft will be replaced by the default ICP configuration. Nothing is applied until you save."
              confirmLabel="Reset draft"
              destructive={false}
              onConfirm={resetDefaults}
              trigger={
                <Button variant="ghost" disabled={!defaults.data || isDefault}>
                  <RotateCcwIcon /> Reset to defaults
                </Button>
              }
            />
            <Button variant="outline" onClick={discard} disabled={!dirty || saveIcp.isPending}>
              <Undo2Icon /> Discard
            </Button>
            {admin && (
              <Button onClick={save} disabled={!dirty || errors.length > 0 || saveIcp.isPending}>
                {saveIcp.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save & re-score
              </Button>
            )}
          </>
        }
      />

      {(errors.length > 0 || serverErrors.length > 0) && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{errors.length ? "Fix these before saving" : "The server rejected this configuration"}</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {[...new Set([...errors, ...serverErrors])].map((e) => (
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
                    total={industries.length}
                    onAll={() => patch({ industries: [...industries] })}
                    onNone={() => patch({ industries: [] })}
                  />
                  <ChipSelect options={industries} value={draft.industries} onChange={(next) => patch({ industries: next })} />
                </Field>
                <Field>
                  <SelectionHeader
                    label="Countries"
                    count={draft.countries.length}
                    total={countries.length}
                    onAll={() => patch({ countries: [...countries] })}
                    onNone={() => patch({ countries: [] })}
                  />
                  <ChipSelect options={countries} value={draft.countries} onChange={(next) => patch({ countries: next })} />
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
                    total={technologies.length}
                    onAll={() => patch({ technologies: [...technologies] })}
                    onNone={() => patch({ technologies: [] })}
                  />
                  <ChipSelect
                    options={technologies}
                    value={draft.technologies}
                    onChange={(next) => patch({ technologies: next })}
                  />
                </Field>
                <Field>
                  <SelectionHeader
                    label="Funding stages"
                    count={draft.fundingStages.length}
                    total={fundingStages.length}
                    onAll={() => patch({ fundingStages: [...fundingStages] })}
                    onNone={() => patch({ fundingStages: [] })}
                  />
                  <ChipSelect
                    options={fundingStages}
                    value={draft.fundingStages}
                    onChange={(next) => patch({ fundingStages: next })}
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
              <CardTitle className="flex items-center gap-2">
                Live preview
                {previewStale && p && <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {p ? `${p.total} accounts re-scored with the ${dirty ? "draft" : "saved"} config` : "Re-scoring accounts…"}
              </CardDescription>
              {dirty && (
                <CardAction>
                  <Badge variant="secondary">Draft</Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className={cn("space-y-4 transition-opacity", previewStale && p && "opacity-60")}>
              {preview.error && !p ? (
                <QueryError error={preview.error} onRetry={() => preview.refetch()} title="Couldn't compute preview" />
              ) : !p ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-14" />
                    ))}
                  </div>
                  <Skeleton className="h-48 w-full" />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border p-2">
                      <div className="text-lg font-semibold tabular-nums">{p.tierChanges}</div>
                      <div className="text-xs text-muted-foreground">tier changes</div>
                    </div>
                    <div className="rounded-lg border p-2">
                      <div className="text-lg font-semibold tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400">↑{p.promoted}</span>{" "}
                        <span className="text-rose-600 dark:text-rose-400">↓{p.demoted}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">promoted / demoted</div>
                    </div>
                    <div className="rounded-lg border p-2">
                      <div className="text-lg font-semibold tabular-nums">
                        {p.avgDraft}
                        <span
                          className={cn(
                            "ml-1 text-xs",
                            p.avgDraft > p.avgCurrent && "text-emerald-600 dark:text-emerald-400",
                            p.avgDraft < p.avgCurrent && "text-rose-600 dark:text-rose-400",
                            p.avgDraft === p.avgCurrent && "text-muted-foreground",
                          )}
                        >
                          {p.avgDraft - p.avgCurrent >= 0 ? "+" : ""}
                          {p.avgDraft - p.avgCurrent}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">avg score</div>
                    </div>
                  </div>
                  <ChartContainer config={tierChart} className="h-48 w-full">
                    <BarChart
                      data={p.distribution.map((d) => ({ ...d, tier: `Tier ${d.tier}` }))}
                      margin={{ left: -20, right: 4 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="tier" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="current" fill="var(--color-current)" radius={4} />
                      <Bar dataKey="draft" fill="var(--color-draft)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                  {preview.error && (
                    <p className="text-xs text-destructive">Preview is out of date: couldn&apos;t re-score with the latest draft.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 10 accounts</CardTitle>
              <CardDescription>Ranked by draft score</CardDescription>
            </CardHeader>
            <CardContent className={cn("px-0 transition-opacity", previewStale && p && "opacity-60")}>
              {!p ? (
                <div className="space-y-2 px-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
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
                    {p.top.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="max-w-44 pl-4">
                          <Link href={`/accounts/${r.id}`} className="flex items-center gap-2 hover:underline">
                            <CompanyAvatar name={r.name} className="size-6 text-[10px]" />
                            <span className="truncate font-medium">{r.name}</span>
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
                            {r.tier !== r.currentTier && (
                              <span className="text-xs text-muted-foreground line-through">{r.currentTier}</span>
                            )}
                            <TierBadge tier={r.tier} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
