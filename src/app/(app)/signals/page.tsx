"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CpuIcon,
  PlusIcon,
  RadioTowerIcon,
  SearchIcon,
  ShuffleIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { RunSummary } from "@/components/agent/run-timeline"
import { useRunToast } from "@/components/agent/run-toast"
import { CompanyAvatar } from "@/components/shared/avatars"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ScoreBar, TierBadge } from "@/components/shared/score"
import { StatCard } from "@/components/shared/stat-card"
import { SignalIcon, StatusBadge } from "@/components/shared/status"
import { SIGNAL_LABELS, SIGNAL_SOURCES } from "@/lib/constants"
import { dateTime, fullName, timeAgo } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Signal, SignalType } from "@/lib/types"

const SIGNAL_TYPES = Object.keys(SIGNAL_LABELS) as SignalType[]
const ALL_SOURCES = Array.from(new Set(Object.values(SIGNAL_SOURCES).flat())).sort()
const PAGE_SIZE = 25
const DAY = 86_400_000
/** Wall-clock read, kept outside render bodies (memoized per data change). */
const currentTime = () => Date.now()

const RANGES = {
  "24h": { label: "Last 24h", ms: DAY },
  "7d": { label: "Last 7 days", ms: 7 * DAY },
  "30d": { label: "Last 30 days", ms: 30 * DAY },
  all: { label: "All time", ms: Infinity },
} as const
type RangeKey = keyof typeof RANGES

const typeChart = {
  count: { label: "Signals", color: "var(--chart-1)" },
} satisfies ChartConfig

// ---------------------------------------------------------------------------
// Ingest dialog
// ---------------------------------------------------------------------------

const NONE = "__none__"

function IngestSignalDialog() {
  const accounts = useStore((s) => s.accounts)
  const contacts = useStore((s) => s.contacts)
  const ingestSignal = useStore((s) => s.ingestSignal)
  const showRun = useRunToast()

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<SignalType>("intent_topic")
  const [accountId, setAccountId] = useState("")
  const [contactId, setContactId] = useState(NONE)
  const [source, setSource] = useState(SIGNAL_SOURCES.intent_topic[0])
  const [title, setTitle] = useState("")
  const [detail, setDetail] = useState("")
  const [strength, setStrength] = useState(70)

  const accountOptions = useMemo(
    () => accounts.filter((a) => !a.duplicateOf).sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  )
  const contactOptions = useMemo(() => contacts.filter((c) => c.accountId === accountId), [contacts, accountId])

  const reset = () => {
    setType("intent_topic")
    setAccountId("")
    setContactId(NONE)
    setSource(SIGNAL_SOURCES.intent_topic[0])
    setTitle("")
    setDetail("")
    setStrength(70)
  }

  const valid = accountId && title.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const run = ingestSignal({
      type,
      accountId,
      contactId: contactId === NONE ? undefined : contactId,
      source,
      title: title.trim(),
      detail: detail.trim(),
      strength,
    })
    showRun(run, "Signal ingested")
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> Ingest signal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Ingest signal</DialogTitle>
            <DialogDescription>
              Push a buying signal into the pipeline. With autopilot on, the agent re-scores the account and runs matching playbooks.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Signal type</FieldLabel>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    const t = v as SignalType
                    setType(t)
                    setSource(SIGNAL_SOURCES[t][0])
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SIGNAL_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Source</FieldLabel>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNAL_SOURCES[type].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Account</FieldLabel>
                <Select
                  value={accountId}
                  onValueChange={(v) => {
                    setAccountId(v)
                    setContactId(NONE)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {accountOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Contact (optional)</FieldLabel>
                <Select value={contactId} onValueChange={setContactId} disabled={!accountId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={NONE}>No specific contact</SelectItem>
                    {contactOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {fullName(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="sig-title">Title</FieldLabel>
              <Input
                id="sig-title"
                placeholder="e.g. Visited pricing page"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sig-detail">Detail</FieldLabel>
              <Textarea
                id="sig-detail"
                placeholder="Context the agent can use when drafting outreach"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            </Field>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Strength</FieldLabel>
                <span className="text-sm font-medium tabular-nums">{strength}</span>
              </div>
              <Slider value={[strength]} onValueChange={([v]) => setStrength(v)} min={0} max={100} step={1} />
              <FieldDescription>How strongly this signal indicates buying intent (0–100).</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>
              <ZapIcon /> Ingest
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Detail sheet
// ---------------------------------------------------------------------------

function SignalSheet({ signalId, onOpenChange }: { signalId: string | null; onOpenChange: (open: boolean) => void }) {
  const signals = useStore((s) => s.signals)
  const runs = useStore((s) => s.runs)
  const rules = useStore((s) => s.rules)
  const processSignal = useStore((s) => s.processSignal)
  const lookup = useLookup()
  const showRun = useRunToast()

  const signal = useMemo(() => signals.find((s) => s.id === signalId), [signals, signalId])
  const related = useMemo(() => runs.filter((r) => r.signalId === signalId), [runs, signalId])
  const account = lookup.account(signal?.accountId)
  const contact = lookup.contact(signal?.contactId)

  return (
    <Sheet open={!!signalId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        {signal && (
          <>
            <SheetHeader>
              <div className="flex items-start gap-3 pr-8">
                <SignalIcon type={signal.type} className="size-10" />
                <div className="min-w-0">
                  <SheetTitle>{signal.title}</SheetTitle>
                  <SheetDescription>
                    {SIGNAL_LABELS[signal.type]} via {signal.source} · {timeAgo(signal.occurredAt)}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
              {signal.detail && <p className="text-sm">{signal.detail}</p>}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Account</dt>
                  <dd className="mt-1">
                    {account ? (
                      <Link href={`/accounts/${account.id}`} className="flex items-center gap-2 hover:underline">
                        <CompanyAvatar name={account.name} className="size-6 text-[10px]" />
                        <span className="truncate font-medium">{account.name}</span>
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Account score</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    {account ? (
                      <>
                        <ScoreBar value={account.score} />
                        <TierBadge tier={account.tier} />
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Contact</dt>
                  <dd className="mt-1">{contact ? `${fullName(contact)} · ${contact.title}` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Strength</dt>
                  <dd className="mt-1">
                    <ScoreBar value={signal.strength} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Occurred</dt>
                  <dd className="mt-1">{dateTime(signal.occurredAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    {signal.processed ? (
                      <StatusBadge status="completed" label="Processed" />
                    ) : (
                      <>
                        <StatusBadge status="pending" />
                        <Button size="xs" onClick={() => showRun(processSignal(signal.id), "Signal processed")}>
                          <CpuIcon /> Process now
                        </Button>
                      </>
                    )}
                  </dd>
                </div>
              </dl>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Agent runs</h3>
                {related.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {signal.processed ? "No agent runs recorded for this signal." : "This signal hasn't been processed by the agent yet."}
                  </p>
                ) : (
                  related.map((r) => (
                    <RunSummary key={r.id} run={r} rule={rules.find((x) => x.id === r.ruleId)} />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SignalsPage() {
  return (
    <Suspense>
      <SignalsPageInner />
    </Suspense>
  )
}

function SignalsPageInner() {
  const searchParams = useSearchParams()
  const signals = useStore((s) => s.signals)
  const autopilot = useStore((s) => s.autopilot)
  const simulateSignal = useStore((s) => s.simulateSignal)
  const processSignal = useStore((s) => s.processSignal)
  const processPending = useStore((s) => s.processPending)
  const lookup = useLookup()
  const showRun = useRunToast()

  const [query, setQuery] = useState("")
  const [type, setType] = useState<SignalType | "all">("all")
  const [source, setSource] = useState("all")
  const [state, setState] = useState<"all" | "pending" | "processed">("all")
  const [range, setRange] = useState<RangeKey>("30d")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string | null>(() => searchParams.get("signal"))

  // Capture "now" once per signals change so memoized filters stay pure.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute "now" whenever signals change
  const now = useMemo(() => currentTime(), [signals])

  const stats = useMemo(() => {
    const within = (ms: number) => signals.filter((s) => now - new Date(s.occurredAt).getTime() <= ms)
    const bySource = new Map<string, number>()
    for (const s of signals) bySource.set(s.source, (bySource.get(s.source) ?? 0) + 1)
    const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1])
    return {
      day: within(DAY).length,
      week: within(7 * DAY).length,
      pending: signals.filter((s) => !s.processed).length,
      sources,
      total: signals.length,
    }
  }, [signals, now])

  const byType = useMemo(() => {
    const recent = signals.filter((s) => now - new Date(s.occurredAt).getTime() <= 30 * DAY)
    return SIGNAL_TYPES.map((t) => ({ type: SIGNAL_LABELS[t], count: recent.filter((s) => s.type === t).length }))
  }, [signals, now])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const maxAge = RANGES[range].ms
    return signals
      .filter((s) => {
        if (type !== "all" && s.type !== type) return false
        if (source !== "all" && s.source !== source) return false
        if (state === "pending" && s.processed) return false
        if (state === "processed" && !s.processed) return false
        if (now - new Date(s.occurredAt).getTime() > maxAge) return false
        if (q) {
          const acc = lookup.account(s.accountId)?.name ?? ""
          const hay = `${s.title} ${s.detail} ${acc} ${s.source}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  }, [signals, query, type, source, state, range, lookup, now])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const rows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const hasFilters = query || type !== "all" || source !== "all" || state !== "all" || range !== "30d"

  const withReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v)
      setPage(0)
    }

  const clearFilters = () => {
    setQuery("")
    setType("all")
    setSource("all")
    setState("all")
    setRange("30d")
    setPage(0)
  }

  const simulate = () => showRun(simulateSignal(), "Simulated signal")

  const processAll = () => {
    const n = processPending()
    toast.success(`Processed ${n} pending signal${n === 1 ? "" : "s"}`, {
      description: "The agent re-scored accounts and ran matching playbooks.",
    })
  }

  return (
    <>
      <PageHeader
        title="Signals"
        description="Buying signals from intent, web, hiring, funding and social sources — the agent's trigger feed."
        actions={
          <>
            {stats.pending > 0 && (
              <Button variant="outline" onClick={processAll}>
                <CpuIcon /> Process {stats.pending} pending
              </Button>
            )}
            <Button variant="outline" onClick={simulate}>
              <ShuffleIcon /> Simulate
            </Button>
            <IngestSignalDialog />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Signals (24h)" value={stats.day} icon={ActivityIcon} hint="ingested today" />
        <StatCard label="Signals (7d)" value={stats.week} icon={RadioTowerIcon} hint={`${stats.total} all time`} />
        <StatCard
          label="Unprocessed"
          value={stats.pending}
          icon={ClockIcon}
          hint={autopilot ? "Autopilot on" : "Autopilot off — signals queue up"}
        />
        <StatCard
          label="Top source"
          value={stats.sources[0]?.[0] ?? "—"}
          icon={SparklesIcon}
          hint={stats.sources[0] ? `${stats.sources[0][1]} signals` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Signals by type</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={typeChart} className="h-56 w-full">
              <BarChart data={byType} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis dataKey="type" type="category" tickLine={false} axisLine={false} width={120} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>Share of all ingested signals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.sources.length === 0 && <p className="text-sm text-muted-foreground">No signals yet.</p>}
            {stats.sources.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => withReset(setSource)(source === name ? "all" : name)}
                className="block w-full space-y-1.5 rounded-md text-left"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className={source === name ? "font-semibold" : "font-medium"}>{name}</span>
                  <span className="text-muted-foreground tabular-nums">{count}</span>
                </div>
                <Progress value={(count / Math.max(1, stats.total)) * 100} />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signal feed</CardTitle>
          <CardDescription>
            {filtered.length} signal{filtered.length === 1 ? "" : "s"} · click a row for details and agent runs
          </CardDescription>
          {hasFilters && (
            <CardAction>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search title, detail or account…"
                className="pl-8"
                value={query}
                onChange={(e) => withReset(setQuery)(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Select value={type} onValueChange={(v) => withReset(setType)(v as SignalType | "all")}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {SIGNAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SIGNAL_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={source} onValueChange={withReset(setSource)}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {ALL_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={state} onValueChange={(v) => withReset(setState)(v as typeof state)}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={range} onValueChange={(v) => withReset(setRange)(v as RangeKey)}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RANGES) as RangeKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {RANGES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={RadioTowerIcon}
              title="No signals match"
              description="Try widening the time range or clearing filters."
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="outline" onClick={simulate}>
                    <ShuffleIcon /> Simulate a signal
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-72">Signal</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Strength</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((s) => (
                      <SignalRow
                        key={s.id}
                        signal={s}
                        onOpen={() => setSelected(s.id)}
                        onProcess={() => showRun(processSignal(s.id), "Signal processed")}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  Showing {currentPage * PAGE_SIZE + 1}–{Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)} of{" "}
                  {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">
                    Page {currentPage + 1} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SignalSheet signalId={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  )
}

function SignalRow({ signal: s, onOpen, onProcess }: { signal: Signal; onOpen: () => void; onProcess: () => void }) {
  const lookup = useLookup()
  const account = lookup.account(s.accountId)
  const contact = lookup.contact(s.contactId)
  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="max-w-96">
        <div className="flex items-start gap-3">
          <SignalIcon type={s.type} />
          <div className="min-w-0">
            <div className="truncate font-medium">{s.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {SIGNAL_LABELS[s.type]}
              {s.detail ? ` · ${s.detail}` : ""}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {account ? (
          <div className="flex items-center gap-2">
            <CompanyAvatar name={account.name} className="size-6 text-[10px]" />
            <Link
              href={`/accounts/${account.id}`}
              className="max-w-40 truncate font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {account.name}
            </Link>
            <TierBadge tier={account.tier} />
          </div>
        ) : (
          <span className="text-muted-foreground">Unknown</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{contact ? fullName(contact) : "—"}</TableCell>
      <TableCell>
        <Badge variant="outline">{s.source}</Badge>
      </TableCell>
      <TableCell>
        <ScoreBar value={s.strength} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{timeAgo(s.occurredAt)}</TableCell>
      <TableCell className="text-right">
        {s.processed ? (
          <StatusBadge status="completed" label="Processed" />
        ) : (
          <div className="flex items-center justify-end gap-2">
            <StatusBadge status="pending" />
            <Button
              size="xs"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                onProcess()
              }}
            >
              Process
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}
