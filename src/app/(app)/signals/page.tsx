"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CpuIcon,
  Loader2Icon,
  PlusIcon,
  RadioTowerIcon,
  SearchIcon,
  ShuffleIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { RunSummary } from "@/components/agent/run-timeline"
import { useRunToast } from "@/components/agent/run-toast"
import { AccountPicker, type PickedAccount } from "@/components/signals/account-picker"
import { useDebounced } from "@/components/signals/use-debounced"
import { CompanyAvatar } from "@/components/shared/avatars"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { QueryError, TableSkeleton } from "@/components/shared/query-state"
import { ScoreBar, TierBadge } from "@/components/shared/score"
import { StatCard } from "@/components/shared/stat-card"
import { SignalIcon, StatusBadge } from "@/components/shared/status"
import {
  canWrite,
  type SignalFilters,
  type SignalRecord,
  useAccountContacts,
  useAgentSettings,
  useCurrentUser,
  useIngestSignal,
  useMeta,
  usePlaybooks,
  useProcessPending,
  useProcessSignal,
  useSignal,
  useSignals,
  useSignalStats,
  useSimulateSignal,
} from "@/lib/api"
import { SIGNAL_LABELS, SIGNAL_SOURCES } from "@/lib/constants"
import { dateTime, fullName, timeAgo } from "@/lib/format"
import type { SignalType } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIGNAL_TYPES = Object.keys(SIGNAL_LABELS) as SignalType[]
const PAGE_SIZE = 25

const RANGES = {
  "24h": { label: "Last 24h", days: 1 },
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  all: { label: "All time", days: undefined },
} as const
type RangeKey = keyof typeof RANGES

const typeChart = {
  count: { label: "Signals", color: "var(--chart-1)" },
} satisfies ChartConfig

/** Sources per signal type — served by the API, with the local constants as a fallback. */
function useSignalSources() {
  const { data } = useMeta()
  return data?.signalSources ?? SIGNAL_SOURCES
}

// ---------------------------------------------------------------------------
// Ingest dialog
// ---------------------------------------------------------------------------

const NONE = "__none__"

function IngestSignalDialog() {
  const sources = useSignalSources()
  const ingest = useIngestSignal()
  const showRun = useRunToast()

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<SignalType>("intent_topic")
  const [account, setAccount] = useState<PickedAccount | null>(null)
  const [contactId, setContactId] = useState(NONE)
  const [source, setSource] = useState<string | undefined>(undefined)
  const [title, setTitle] = useState("")
  const [detail, setDetail] = useState("")
  const [strength, setStrength] = useState(70)

  const contacts = useAccountContacts(account?.id)
  const contactOptions = contacts.data ?? []
  const sourceOptions = sources[type] ?? []
  // Default to the first source for the selected type until the user picks one.
  const effectiveSource = source && sourceOptions.includes(source) ? source : sourceOptions[0]

  const reset = () => {
    setType("intent_topic")
    setAccount(null)
    setContactId(NONE)
    setSource(undefined)
    setTitle("")
    setDetail("")
    setStrength(70)
  }

  const valid = !!account && !!title.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!account || !valid) return
    ingest.mutate(
      {
        type,
        accountId: account.id,
        contactId: contactId === NONE ? undefined : contactId,
        source: effectiveSource,
        title: title.trim(),
        detail: detail.trim() || undefined,
        strength,
      },
      {
        onSuccess: (r) => {
          showRun(r.run, "Signal ingested", { accountName: account.name })
          setOpen(false)
          reset()
        },
      },
    )
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
                    setType(v as SignalType)
                    setSource(undefined)
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
                <Select value={effectiveSource} onValueChange={setSource}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((s) => (
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
                <AccountPicker
                  value={account}
                  onChange={(a) => {
                    setAccount(a)
                    setContactId(NONE)
                  }}
                />
              </Field>
              <Field>
                <FieldLabel>Contact (optional)</FieldLabel>
                <Select value={contactId} onValueChange={setContactId} disabled={!account || contacts.isLoading}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={contacts.isLoading ? "Loading…" : undefined} />
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
            <Button type="submit" disabled={!valid || ingest.isPending}>
              {ingest.isPending ? <Loader2Icon className="animate-spin" /> : <ZapIcon />} Ingest
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
  const user = useCurrentUser()
  const { data: signal, isLoading, error, refetch } = useSignal(signalId)
  const playbooks = usePlaybooks()
  const processSignal = useProcessSignal()
  const showRun = useRunToast()

  const ruleName = (id?: string) => (id ? playbooks.data?.find((p) => p.id === id)?.name : undefined)
  const account = signal?.account
  const contact = signal?.contact
  const related = signal?.runs ?? []

  return (
    <Sheet open={!!signalId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        {isLoading ? (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">Loading signal</SheetTitle>
              <div className="flex items-start gap-3 pr-8">
                <Skeleton className="size-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </SheetHeader>
            <div className="space-y-3 px-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </>
        ) : error || !signal ? (
          <>
            <SheetHeader>
              <SheetTitle>Signal not found</SheetTitle>
              <SheetDescription>This signal may have been deleted.</SheetDescription>
            </SheetHeader>
            {error && (
              <div className="px-4">
                <QueryError error={error} onRetry={() => refetch()} title="Couldn't load signal" />
              </div>
            )}
          </>
        ) : (
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
                        {canWrite(user.role) && (
                          <Button
                            size="xs"
                            disabled={processSignal.isPending}
                            onClick={() =>
                              processSignal.mutate(signal.id, {
                                onSuccess: (run) => showRun(run, signal.title, { accountName: account?.name }),
                              })
                            }
                          >
                            {processSignal.isPending ? <Loader2Icon className="animate-spin" /> : <CpuIcon />} Process now
                          </Button>
                        )}
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
                    <RunSummary key={r.id} run={r} ruleName={ruleName(r.ruleId)} />
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
  const user = useCurrentUser()
  const writable = canWrite(user.role)
  const meta = useMeta()
  const sources = useSignalSources()
  const settings = useAgentSettings()
  const statsQuery = useSignalStats()
  const simulateSignal = useSimulateSignal()
  const processSignal = useProcessSignal()
  const processPending = useProcessPending()
  const showRun = useRunToast()

  const [query, setQuery] = useState("")
  const [type, setType] = useState<SignalType | "all">("all")
  const [source, setSource] = useState("all")
  const [state, setState] = useState<"all" | "pending" | "processed">("all")
  const [range, setRange] = useState<RangeKey>("30d")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(() => searchParams.get("signal"))
  const debouncedQuery = useDebounced(query.trim(), 250)

  const filters: SignalFilters = {
    page,
    pageSize: PAGE_SIZE,
    q: debouncedQuery || undefined,
    type: type === "all" ? undefined : [type],
    source: source === "all" ? undefined : [source],
    processed: state === "all" ? undefined : state === "processed",
    sinceDays: RANGES[range].days,
  }
  const signalsQuery = useSignals(filters)
  const rows = signalsQuery.data?.data ?? []
  const total = signalsQuery.data?.meta.total ?? 0

  const stats = statsQuery.data
  const statsLoading = !stats && statsQuery.isLoading
  const autopilot = settings.data?.autopilot
  const simulationEnabled = !!meta.data?.features.simulation
  const pending = stats?.unprocessed ?? 0
  const byType = SIGNAL_TYPES.map((t) => ({
    type: SIGNAL_LABELS[t],
    count: stats?.byType30d.find((x) => x.type === t)?.count ?? 0,
  }))
  const allSources = Array.from(
    new Set([...Object.values(sources).flat(), ...(stats?.bySource.map((x) => x.source) ?? [])]),
  ).sort()

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const hasFilters = query || type !== "all" || source !== "all" || state !== "all" || range !== "30d"

  const withReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v)
      setPage(1)
    }

  const clearFilters = () => {
    setQuery("")
    setType("all")
    setSource("all")
    setState("all")
    setRange("30d")
    setPage(1)
  }

  const simulate = () =>
    simulateSignal.mutate(undefined, {
      onSuccess: (r) => showRun(r.run, `Simulated: ${r.signal.title}`),
    })

  const processRow = (s: SignalRecord) =>
    processSignal.mutate(s.id, {
      onSuccess: (run) => showRun(run, s.title, { accountName: s.account?.name }),
    })

  return (
    <>
      <PageHeader
        title="Signals"
        description="Buying signals from intent, web, hiring, funding and social sources — the agent's trigger feed."
        actions={
          writable && (
            <>
              {pending > 0 && (
                <Button variant="outline" onClick={() => processPending.mutate()} disabled={processPending.isPending}>
                  {processPending.isPending ? <Loader2Icon className="animate-spin" /> : <CpuIcon />} Process {pending} pending
                </Button>
              )}
              {simulationEnabled && (
                <Button variant="outline" onClick={simulate} disabled={simulateSignal.isPending}>
                  {simulateSignal.isPending ? <Loader2Icon className="animate-spin" /> : <ShuffleIcon />} Simulate
                </Button>
              )}
              <IngestSignalDialog />
            </>
          )
        }
      />

      {statsQuery.error && (
        <QueryError error={statsQuery.error} onRetry={() => statsQuery.refetch()} title="Couldn't load signal stats" />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Signals (24h)" value={stats?.last24h ?? 0} icon={ActivityIcon} hint="ingested today" />
            <StatCard
              label="Signals (7d)"
              value={stats?.last7d ?? 0}
              icon={RadioTowerIcon}
              hint={`${stats?.total ?? 0} all time`}
            />
            <StatCard
              label="Unprocessed"
              value={pending}
              icon={ClockIcon}
              hint={autopilot === undefined ? undefined : autopilot ? "Autopilot on" : "Autopilot off — signals queue up"}
            />
            <StatCard
              label="Top source"
              value={stats?.topSource ?? "—"}
              icon={SparklesIcon}
              hint={stats?.bySource[0] ? `${stats.bySource[0].count} signals` : undefined}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Signals by type</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ChartContainer config={typeChart} className="h-56 w-full">
                <BarChart data={byType} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis dataKey="type" type="category" tickLine={false} axisLine={false} width={120} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>Share of all ingested signals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statsLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            {stats && stats.bySource.length === 0 && <p className="text-sm text-muted-foreground">No signals yet.</p>}
            {stats?.bySource.map(({ source: name, count }) => (
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
            {signalsQuery.data ? `${total} signal${total === 1 ? "" : "s"}` : "Loading signals"} · click a row for details and
            agent runs
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
                  {allSources.map((s) => (
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

          {signalsQuery.error ? (
            <QueryError error={signalsQuery.error} onRetry={() => signalsQuery.refetch()} title="Couldn't load signals" />
          ) : !signalsQuery.data ? (
            <TableSkeleton rows={8} className="rounded-lg border" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={RadioTowerIcon}
              title="No signals match"
              description="Try widening the time range or clearing filters."
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : writable && simulationEnabled ? (
                  <Button variant="outline" onClick={simulate} disabled={simulateSignal.isPending}>
                    <ShuffleIcon /> Simulate a signal
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div
                className={cn(
                  "overflow-hidden rounded-lg border transition-opacity",
                  signalsQuery.isPlaceholderData && "opacity-60",
                )}
              >
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
                        onProcess={writable ? () => processRow(s) : undefined}
                        processing={processSignal.isPending && processSignal.variables === s.id}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(total, currentPage * PAGE_SIZE)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">
                    Page {currentPage} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage >= pageCount}
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

function SignalRow({
  signal: s,
  onOpen,
  onProcess,
  processing,
}: {
  signal: SignalRecord
  onOpen: () => void
  onProcess?: () => void
  processing?: boolean
}) {
  const { account, contact } = s
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
            {onProcess && (
              <Button
                size="xs"
                variant="outline"
                disabled={processing}
                onClick={(e) => {
                  e.stopPropagation()
                  onProcess()
                }}
              >
                {processing && <Loader2Icon className="animate-spin" />}
                Process
              </Button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}
