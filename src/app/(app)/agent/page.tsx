"use client"

import { Suspense, useCallback, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ActivityIcon,
  ArrowRightIcon,
  BotIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CpuIcon,
  InboxIcon,
  ListChecksIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShuffleIcon,
  Trash2Icon,
  WorkflowIcon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { DraftReviewCard } from "@/components/agent/draft-review-card"
import { formatDuration, ScoreDelta, StepTimeline } from "@/components/agent/run-timeline"
import { useRunToast } from "@/components/agent/run-toast"
import { CompanyAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { QueryError, TableSkeleton } from "@/components/shared/query-state"
import { ScoreBar, TierBadge } from "@/components/shared/score"
import { StatCard } from "@/components/shared/stat-card"
import { SignalIcon, StatusBadge } from "@/components/shared/status"
import {
  canWrite,
  errorMessage,
  isAdmin,
  type PlaybookInput,
  type PlaybookRecord,
  useAgentRun,
  useAgentRuns,
  useAgentSettings,
  useAgentStats,
  useCreatePlaybook,
  useCurrentUser,
  useDeletePlaybook,
  useDrafts,
  useMeta,
  usePlaybooks,
  useProcessPending,
  useSequences,
  useSetAutopilot,
  useSignalStats,
  useSimulateSignal,
  useUpdatePlaybook,
} from "@/lib/api"
import { ACTION_LABELS, SIGNAL_LABELS } from "@/lib/constants"
import { dateTime, fullName, percent, timeAgo } from "@/lib/format"
import type { AgentActionType, AgentRun, SignalType, Tier } from "@/lib/types"
import { cn } from "@/lib/utils"

const TABS = ["runs", "approvals", "playbooks"] as const
type TabKey = (typeof TABS)[number]
const PAGE_SIZE = 25
/** Shared query params so the header badge and the Approvals tab reuse one cache entry. */
const PENDING_DRAFTS = { status: ["pending"], pageSize: 50, sort: "createdAt:desc" } as const satisfies Parameters<typeof useDrafts>[0]
const REVIEWED_DRAFTS = { status: ["sent", "rejected"], pageSize: 10, sort: "createdAt:desc" } as const satisfies Parameters<typeof useDrafts>[0]
const ALL_TIERS: Tier[] = ["A", "B", "C", "D"]
const ACTION_KEYS = Object.keys(ACTION_LABELS) as AgentActionType[]
const SIGNAL_TYPES = Object.keys(SIGNAL_LABELS) as SignalType[]
const RUN_STATUSES: AgentRun["status"][] = ["completed", "awaiting_approval", "failed", "skipped"]
const SHORT_ACTION: Record<AgentActionType, string> = {
  rescore: "Re-score",
  route_owner: "Route",
  draft_outreach: "Draft",
  enroll_sequence: "Enroll",
  create_deal: "Deal",
  notify: "Notify",
  enrich: "Enrich",
}

export default function AgentPage() {
  return (
    <Suspense>
      <AgentPageInner />
    </Suspense>
  )
}

function AgentPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const user = useCurrentUser()
  const writable = canWrite(user.role)
  const meta = useMeta()
  const settings = useAgentSettings()
  const setAutopilot = useSetAutopilot()
  const statsQuery = useAgentStats()
  const signalStats = useSignalStats()
  const pendingDraftsQuery = useDrafts({ ...PENDING_DRAFTS, status: [...PENDING_DRAFTS.status] })
  const simulateSignal = useSimulateSignal()
  const processPending = useProcessPending()
  const showRun = useRunToast()

  const autopilot = !!settings.data?.autopilot
  const stats = statsQuery.data
  const pendingDraftCount = pendingDraftsQuery.data?.meta.total ?? 0
  const pendingSignals = signalStats.data?.unprocessed ?? 0
  const simulationEnabled = !!meta.data?.features.simulation

  const tabParam = params.get("tab")
  const tab: TabKey = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as TabKey) : "runs"
  const runId = params.get("run")

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k)
        else next.set(k, v)
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )

  return (
    <>
      <PageHeader
        title="Orchestration Agent"
        description="The agent watches signals, re-scores accounts and runs your playbooks — routing, drafting and enrolling automatically."
        actions={
          writable && (
            <>
              {pendingSignals > 0 && (
                <Button variant="outline" onClick={() => processPending.mutate()} disabled={processPending.isPending}>
                  {processPending.isPending ? <Loader2Icon className="animate-spin" /> : <CpuIcon />} Process {pendingSignals}{" "}
                  pending
                </Button>
              )}
              {simulationEnabled && (
                <Button
                  disabled={simulateSignal.isPending}
                  onClick={() => simulateSignal.mutate(undefined, { onSuccess: (r) => showRun(r.run, `Simulated: ${r.signal.title}`) })}
                >
                  {simulateSignal.isPending ? <Loader2Icon className="animate-spin" /> : <ShuffleIcon />} Simulate signal
                </Button>
              )}
            </>
          )
        }
      />

      <Card className={cn("py-4", autopilot && "border-primary/30 bg-primary/5")}>
        <CardContent className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              autopilot ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <BotIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 font-medium">
              Autopilot
              <StatusBadge status={autopilot ? "active" : "paused"} label={autopilot ? "On" : "Off"} />
            </div>
            <p className="text-sm text-muted-foreground">
              {autopilot
                ? "New signals are processed instantly: the agent re-scores the account, evaluates playbooks and takes action. Drafts that require approval wait in the Approvals queue."
                : "Signals are queued without action. Turn autopilot on, or process pending signals manually."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="autopilot" className="text-sm">
              {autopilot ? "Enabled" : "Disabled"}
            </Label>
            <Switch
              id="autopilot"
              checked={setAutopilot.isPending ? setAutopilot.variables : autopilot}
              disabled={!writable || !settings.data || setAutopilot.isPending}
              onCheckedChange={(on) => setAutopilot.mutate(on)}
            />
          </div>
        </CardContent>
      </Card>

      {statsQuery.error && (
        <QueryError error={statsQuery.error} onRetry={() => statsQuery.refetch()} title="Couldn't load agent stats" />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!stats && statsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Runs today"
              value={stats?.runsToday ?? 0}
              icon={ActivityIcon}
              hint={`${stats?.runs7d ?? 0} in the last 7 days`}
            />
            <StatCard
              label="Actions taken"
              value={stats?.actionsTaken ?? 0}
              icon={ZapIcon}
              hint={`across ${stats?.totalRuns ?? 0} runs`}
            />
            <StatCard
              label="Awaiting approval"
              value={pendingDraftCount}
              icon={ClockIcon}
              hint={pendingDraftCount ? "drafts need review" : "queue is clear"}
            />
            <StatCard
              label="Success rate"
              value={percent(stats?.successRate ?? 0, 0)}
              icon={CheckCircle2Icon}
              hint={`${stats?.completed ?? 0} completed · ${stats?.failed ?? 0} failed`}
            />
          </>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v === "runs" ? null : v })} className="gap-4">
        <TabsList>
          <TabsTrigger value="runs">
            <ActivityIcon /> Activity
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <InboxIcon /> Approvals
            {pendingDraftCount > 0 && (
              <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">{pendingDraftCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="playbooks">
            <WorkflowIcon /> Playbooks
          </TabsTrigger>
        </TabsList>
        <TabsContent value="runs">
          <RunsTab onOpen={(id) => setParams({ run: id })} />
        </TabsContent>
        <TabsContent value="approvals">
          <ApprovalsTab />
        </TabsContent>
        <TabsContent value="playbooks">
          <PlaybooksTab />
        </TabsContent>
      </Tabs>

      <RunSheet runId={runId} onClose={() => setParams({ run: null })} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Activity tab
// ---------------------------------------------------------------------------

function RunsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<AgentRun["status"] | "all">("all")
  const [page, setPage] = useState(1)
  const runsQuery = useAgentRuns({
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : [status],
    sort: "startedAt:desc",
  })
  const { data: stats } = useAgentStats()

  const rows = runsQuery.data?.data ?? []
  const total = runsQuery.data?.meta.total ?? 0
  const count = (s: AgentRun["status"]) => stats?.byStatus.find((x) => x.status === s)?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(page, pageCount)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent activity</CardTitle>
        <CardDescription>Every signal the agent evaluated and what it did. Click a run for the step-by-step trace.</CardDescription>
        <CardAction>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as typeof status)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses{stats ? ` (${stats.totalRuns})` : ""}</SelectItem>
              {RUN_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "awaiting_approval" ? "Awaiting approval" : s.charAt(0).toUpperCase() + s.slice(1)}
                  {stats ? ` (${count(s)})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {runsQuery.error ? (
          <QueryError error={runsQuery.error} onRetry={() => runsQuery.refetch()} title="Couldn't load agent runs" />
        ) : !runsQuery.data ? (
          <TableSkeleton rows={8} className="rounded-lg border" />
        ) : rows.length === 0 ? (
          <EmptyState icon={BotIcon} title="No agent runs" description="Simulate or ingest a signal to see the agent in action." />
        ) : (
          <>
            <div className={cn("overflow-hidden rounded-lg border transition-opacity", runsQuery.isPlaceholderData && "opacity-60")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="min-w-56">Trigger</TableHead>
                    <TableHead>Playbook</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const account = r.account
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => onOpen(r.id)}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{timeAgo(r.startedAt)}</TableCell>
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
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Deleted account</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-72 truncate">{r.trigger}</TableCell>
                        <TableCell className="max-w-48 truncate">
                          {r.ruleId ? (
                            (r.ruleName ?? <span className="text-muted-foreground">Deleted playbook</span>)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <ScoreDelta before={r.scoreBefore} after={r.scoreAfter} />
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{formatDuration(r.durationMs)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {total} run{total === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  Page {current} / {pageCount}
                </span>
                <Button variant="outline" size="icon-sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
                  <ChevronLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={current >= pageCount}
                  onClick={() => setPage(current + 1)}
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
  )
}

function RunSheet({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const { data: run, isLoading, error, refetch } = useAgentRun(runId)

  const runDrafts = run?.drafts ?? []
  const pending = runDrafts.find((d) => d.status === "pending")
  const reviewed = runDrafts.filter((d) => d.status !== "pending")
  const account = run?.account
  const signal = run?.signal

  return (
    <Sheet open={!!runId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl">
        {isLoading ? (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">Loading run</SheetTitle>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </SheetHeader>
            <div className="space-y-3 px-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
              <Skeleton className="h-60 w-full" />
            </div>
          </>
        ) : !run ? (
          <>
            <SheetHeader>
              <SheetTitle>Run not found</SheetTitle>
              <SheetDescription>This agent run no longer exists.</SheetDescription>
            </SheetHeader>
            {error && (
              <div className="px-4">
                <QueryError error={error} onRetry={() => refetch()} title="Couldn't load run" />
              </div>
            )}
          </>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 pr-8">
                <SheetTitle>{run.ruleName ?? (run.ruleId ? "Deleted playbook" : "Signal evaluation")}</SheetTitle>
                <StatusBadge status={run.status} />
              </div>
              <SheetDescription>
                {dateTime(run.startedAt)} · took {formatDuration(run.durationMs)}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="mb-2 text-xs text-muted-foreground">Account</div>
                  {account ? (
                    <Link href={`/accounts/${account.id}`} className="flex items-center gap-2 hover:underline">
                      <CompanyAvatar name={account.name} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{account.name}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <TierBadge tier={account.tier} />
                          <ScoreDelta before={run.scoreBefore} after={run.scoreAfter} />
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Deleted account</span>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <div className="mb-2 text-xs text-muted-foreground">Trigger</div>
                  {signal ? (
                    <Link href={`/signals?signal=${signal.id}`} className="flex items-center gap-2 hover:underline">
                      <SignalIcon type={signal.type} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{signal.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {signal.source} · strength {signal.strength}
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="text-sm">{run.trigger}</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Steps</h3>
                <StepTimeline steps={run.steps} />
              </div>

              {pending && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Draft awaiting approval</h3>
                    <DraftReviewCard key={pending.id} draft={pending} compact />
                  </div>
                </>
              )}

              {reviewed.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Outreach</h3>
                    {reviewed.map((d) => (
                      <div key={d.id} className="space-y-1 rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{d.subject}</span>
                          <StatusBadge status={d.status} />
                        </div>
                        <p className="line-clamp-3 text-xs whitespace-pre-line text-muted-foreground">{d.body}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}


// ---------------------------------------------------------------------------
// Approvals tab
// ---------------------------------------------------------------------------

function ApprovalsTab() {
  const [open, setOpen] = useState(false)
  const pendingQuery = useDrafts({ ...PENDING_DRAFTS, status: [...PENDING_DRAFTS.status] })
  const reviewedQuery = useDrafts({ ...REVIEWED_DRAFTS, status: [...REVIEWED_DRAFTS.status] })

  const pending = pendingQuery.data?.data ?? []
  const reviewed = reviewedQuery.data?.data ?? []
  const pendingTotal = pendingQuery.data?.meta.total ?? 0

  return (
    <div className="space-y-4">
      {pendingQuery.error ? (
        <QueryError error={pendingQuery.error} onRetry={() => pendingQuery.refetch()} title="Couldn't load drafts" />
      ) : !pendingQuery.data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title="All caught up"
          description="No drafts are waiting for review. Playbooks that require approval will queue drafts here."
        />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {pending.map((d) => (
              <DraftReviewCard key={d.id} draft={d} />
            ))}
          </div>
          {pendingTotal > pending.length && (
            <p className="text-center text-sm text-muted-foreground">
              Showing the {pending.length} newest of {pendingTotal} pending drafts — review these to load more.
            </p>
          )}
        </>
      )}

      <Collapsible open={open} onOpenChange={setOpen}>
        <Card className="gap-0 py-0">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
              <div>
                <div className="font-medium">Recently reviewed</div>
                <div className="text-sm text-muted-foreground">
                  {reviewedQuery.data ? `${reviewed.length} sent or rejected drafts` : "Loading…"}
                </div>
              </div>
              <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Separator />
            {reviewedQuery.error ? (
              <div className="p-4">
                <QueryError error={reviewedQuery.error} onRetry={() => reviewedQuery.refetch()} />
              </div>
            ) : !reviewedQuery.data ? (
              <TableSkeleton rows={3} />
            ) : reviewed.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nothing reviewed yet.</p>
            ) : (
              <ul className="divide-y">
                {reviewed.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    {d.account && <CompanyAvatar name={d.account.name} />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{d.subject}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {d.account?.name ?? "Unknown"} · {d.contact ? fullName(d.contact) : "Unknown contact"} ·{" "}
                        {d.channel === "linkedin" ? "LinkedIn" : "Email"} · {timeAgo(d.createdAt)}
                      </div>
                    </div>
                    {d.runId && (
                      <Button asChild variant="ghost" size="xs" className="hidden sm:inline-flex">
                        <Link href={`/agent?tab=approvals&run=${d.runId}`}>View run</Link>
                      </Button>
                    )}
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Playbooks tab
// ---------------------------------------------------------------------------

function PlaybooksTab() {
  const user = useCurrentUser()
  const admin = isAdmin(user.role)
  const playbooks = usePlaybooks()
  const updatePlaybook = useUpdatePlaybook()
  const deletePlaybook = useDeletePlaybook()
  const [editing, setEditing] = useState<PlaybookRecord | "new" | null>(null)

  const rules = playbooks.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Playbooks are evaluated in order; the first enabled playbook whose trigger, minimum score and tiers match runs.
          {!admin && " Only workspace admins can change playbooks."}
        </p>
        {admin && (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon /> New playbook
          </Button>
        )}
      </div>

      {playbooks.error ? (
        <QueryError error={playbooks.error} onRetry={() => playbooks.refetch()} title="Couldn't load playbooks" />
      ) : !playbooks.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="No playbooks yet"
          description="Create a playbook to tell the agent what to do when signals arrive."
          action={
            admin ? (
              <Button onClick={() => setEditing("new")}>
                <PlusIcon /> New playbook
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.map((r, i) => {
            const flow = [r.trigger === "any" ? "Any signal" : SIGNAL_LABELS[r.trigger], ...r.actions.map((a) => SHORT_ACTION[a])]
            const toggling = updatePlaybook.isPending && updatePlaybook.variables?.id === r.id
            const enabled = toggling && updatePlaybook.variables?.enabled !== undefined ? updatePlaybook.variables.enabled : r.enabled
            return (
              <Card key={r.id} className={cn(!enabled && "opacity-70")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">#{i + 1}</span>
                    <span className="truncate">{r.name}</span>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">{r.description || "No description"}</CardDescription>
                  <CardAction>
                    <Switch
                      checked={enabled}
                      disabled={!admin || toggling}
                      aria-label={enabled ? "Disable playbook" : "Enable playbook"}
                      onCheckedChange={(on) =>
                        updatePlaybook.mutate(
                          { id: r.id, enabled: on },
                          { onSuccess: () => toast(on ? `“${r.name}” enabled` : `“${r.name}” disabled`) },
                        )
                      }
                    />
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {flow.map((step, idx) => (
                      <span key={idx} className="flex items-center gap-1.5">
                        {idx > 0 && <ArrowRightIcon className="size-3 text-muted-foreground" />}
                        <Badge
                          variant={idx === 0 ? "default" : "outline"}
                          className={cn(idx === 0 && r.trigger !== "any" && "gap-1")}
                        >
                          {step}
                        </Badge>
                      </span>
                    ))}
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">Min score</dt>
                      <dd className="mt-1">
                        <ScoreBar value={r.minScore} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Tiers</dt>
                      <dd className="mt-1 flex flex-wrap gap-1">
                        {r.tiers.length ? (
                          [...r.tiers].sort().map((t) => (
                            <TierBadge key={t} tier={t} className="h-4 px-1.5 text-[10px]" />
                          ))
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Approval</dt>
                      <dd className="mt-1">
                        {r.requireApproval ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <ShieldCheckIcon className="size-3.5" /> Required
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <ZapIcon className="size-3.5" /> Auto-send
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Runs</dt>
                      <dd className="mt-1 font-medium tabular-nums">{r.runs}</dd>
                    </div>
                  </dl>
                  <div className="flex items-center gap-2 text-sm">
                    <ListChecksIcon className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Sequence:</span>
                    {r.sequenceId && r.sequenceName ? (
                      <Link href={`/outreach/${r.sequenceId}`} className="truncate font-medium hover:underline">
                        {r.sequenceName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </div>
                </CardContent>
                {admin && (
                  <CardFooter className="justify-end gap-2">
                    <ConfirmDialog
                      title={`Delete “${r.name}”?`}
                      description="The agent will stop running this playbook. Past runs are kept."
                      confirmLabel="Delete"
                      onConfirm={() => deletePlaybook.mutate(r.id)}
                      trigger={
                        <Button variant="ghost" size="sm" disabled={deletePlaybook.isPending && deletePlaybook.variables === r.id}>
                          <Trash2Icon /> Delete
                        </Button>
                      }
                    />
                    <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                      <PencilIcon /> Edit
                    </Button>
                  </CardFooter>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          {editing !== null && (
            <PlaybookForm
              key={editing === "new" ? "new" : editing.id}
              rule={editing === "new" ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const NO_SEQ = "__none__"

function PlaybookForm({ rule, onDone }: { rule?: PlaybookRecord; onDone: () => void }) {
  const sequencesQuery = useSequences({ pageSize: 100, sort: "name:asc" })
  const createPlaybook = useCreatePlaybook()
  const updatePlaybook = useUpdatePlaybook()
  const sequences = sequencesQuery.data?.data ?? []
  const saving = createPlaybook.isPending || updatePlaybook.isPending

  const [name, setName] = useState(rule?.name ?? "")
  const [description, setDescription] = useState(rule?.description ?? "")
  const [trigger, setTrigger] = useState<SignalType | "any">(rule?.trigger ?? "any")
  const [minScore, setMinScore] = useState(rule?.minScore ?? 50)
  const [tiers, setTiers] = useState<Tier[]>(rule?.tiers ?? ["A", "B"])
  const [actions, setActions] = useState<AgentActionType[]>(
    rule ? Array.from(new Set<AgentActionType>(["rescore", ...rule.actions])) : ["rescore", "route_owner", "draft_outreach"],
  )
  const [sequenceId, setSequenceId] = useState(rule?.sequenceId ?? NO_SEQ)
  const [requireApproval, setRequireApproval] = useState(rule?.requireApproval ?? true)
  const [serverError, setServerError] = useState<string | null>(null)
  const enabled = rule?.enabled ?? true

  const needsSequence = actions.includes("enroll_sequence") && sequenceId === NO_SEQ
  const [touched, setTouched] = useState(false)
  const errors = [
    !name.trim() && "Name is required.",
    tiers.length === 0 && "Select at least one tier.",
    needsSequence && "“Enroll in sequence” requires a sequence.",
  ].filter(Boolean) as string[]
  const visibleErrors = touched ? errors : errors.filter((e) => !e.startsWith("Name"))

  const toggleTier = (t: Tier, on: boolean) =>
    setTiers((cur) => (on ? ALL_TIERS.filter((x) => x === t || cur.includes(x)) : cur.filter((x) => x !== t)))
  const toggleAction = (a: AgentActionType, on: boolean) =>
    setActions((cur) => (on ? ACTION_KEYS.filter((x) => x === a || cur.includes(x)) : cur.filter((x) => x !== a)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setServerError(null)
    if (errors.length) return
    const payload: PlaybookInput = {
      name: name.trim(),
      description: description.trim(),
      trigger,
      minScore,
      tiers,
      actions: ACTION_KEYS.filter((a) => a === "rescore" || actions.includes(a)),
      requireApproval,
      enabled,
    }
    const onError = (err: Error) => setServerError(errorMessage(err))
    if (rule) {
      updatePlaybook.mutate(
        { id: rule.id, ...payload, sequenceId: sequenceId === NO_SEQ ? null : sequenceId },
        {
          onSuccess: (r) => {
            toast.success("Playbook updated", { description: r.name })
            onDone()
          },
          onError,
        },
      )
    } else {
      createPlaybook.mutate(
        { ...payload, ...(sequenceId === NO_SEQ ? {} : { sequenceId }) },
        { onSuccess: () => onDone(), onError },
      )
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{rule ? "Edit playbook" : "New playbook"}</DialogTitle>
        <DialogDescription>Define when the agent should act and what it should do.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[65vh] overflow-y-auto pr-1">
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="pb-name">Name</FieldLabel>
              <Input id="pb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pricing page visitors" />
            </Field>
            <Field>
              <FieldLabel>Trigger</FieldLabel>
              <Select value={trigger} onValueChange={(v) => setTrigger(v as SignalType | "any")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any signal</SelectItem>
                  {SIGNAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SIGNAL_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="pb-desc">Description</FieldLabel>
            <Textarea
              id="pb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this playbook is for"
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel>Minimum score</FieldLabel>
              <span className="text-sm font-medium tabular-nums">{minScore}</span>
            </div>
            <Slider value={[minScore]} onValueChange={([v]) => setMinScore(v)} min={0} max={100} step={1} />
            <FieldDescription>Account score (after re-scoring) must be at least this value.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Tiers</FieldLabel>
            <div className="flex flex-wrap gap-4">
              {ALL_TIERS.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={tiers.includes(t)} onCheckedChange={(c) => toggleTier(t, c === true)} />
                  <TierBadge tier={t} />
                </label>
              ))}
            </div>
          </Field>
          <Field>
            <FieldLabel>Actions</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACTION_KEYS.map((a) => {
                const locked = a === "rescore"
                return (
                  <label
                    key={a}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      actions.includes(a) && "border-primary/40 bg-primary/5",
                      locked && "opacity-80",
                    )}
                  >
                    <Checkbox
                      checked={locked || actions.includes(a)}
                      disabled={locked}
                      onCheckedChange={(c) => toggleAction(a, c === true)}
                    />
                    <span className="flex-1">{ACTION_LABELS[a]}</span>
                    {locked && <span className="text-xs text-muted-foreground">Always on</span>}
                  </label>
                )
              })}
            </div>
          </Field>
          <Field>
            <FieldLabel>Sequence</FieldLabel>
            <Select value={sequenceId} onValueChange={setSequenceId}>
              <SelectTrigger className="w-full" aria-invalid={needsSequence}>
                <SelectValue placeholder={sequencesQuery.isLoading ? "Loading sequences…" : undefined} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SEQ}>No sequence</SelectItem>
                {/* Keep the current selection visible even if it isn't in the loaded page. */}
                {rule?.sequenceId && rule.sequenceName && !sequences.some((s) => s.id === rule.sequenceId) && (
                  <SelectItem value={rule.sequenceId}>{rule.sequenceName}</SelectItem>
                )}
                {sequences.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Used by “Enroll in sequence” and approved drafts.</FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="pb-approval">Require approval</FieldLabel>
              <FieldDescription>Drafted outreach waits in the Approvals queue instead of sending automatically.</FieldDescription>
            </FieldContent>
            <Switch id="pb-approval" checked={requireApproval} onCheckedChange={setRequireApproval} />
          </Field>
        </FieldGroup>
      </div>
      {(visibleErrors.length > 0 || serverError) && (
        <ul className="list-inside list-disc text-sm text-destructive">
          {visibleErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
          {serverError && <li>{serverError}</li>}
        </ul>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={(touched && errors.length > 0) || saving}>
          {saving && <Loader2Icon className="animate-spin" />}
          {rule ? "Save changes" : "Create playbook"}
        </Button>
      </DialogFooter>
    </form>
  )
}
