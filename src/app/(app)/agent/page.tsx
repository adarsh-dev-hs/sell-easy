"use client"

import { Suspense, useCallback, useMemo, useState } from "react"
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
import { ScoreBar, TierBadge } from "@/components/shared/score"
import { StatCard } from "@/components/shared/stat-card"
import { SignalIcon, StatusBadge } from "@/components/shared/status"
import { ACTION_LABELS, SIGNAL_LABELS } from "@/lib/constants"
import { dateTime, fullName, percent, timeAgo } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { AgentActionType, AgentRun, PlaybookRule, SignalType, Tier } from "@/lib/types"
import { cn } from "@/lib/utils"

const TABS = ["runs", "approvals", "playbooks"] as const
type TabKey = (typeof TABS)[number]
const PAGE_SIZE = 25
const DAY = 86_400_000
/** Wall-clock read, kept outside render bodies (memoized per data change). */
const currentTime = () => Date.now()
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

  const runs = useStore((s) => s.runs)
  const drafts = useStore((s) => s.drafts)
  const signals = useStore((s) => s.signals)
  const autopilot = useStore((s) => s.autopilot)
  const setAutopilot = useStore((s) => s.setAutopilot)
  const simulateSignal = useStore((s) => s.simulateSignal)
  const processPending = useStore((s) => s.processPending)
  const showRun = useRunToast()

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

  const pendingDrafts = useMemo(() => drafts.filter((d) => d.status === "pending"), [drafts])
  const pendingSignals = useMemo(() => signals.filter((s) => !s.processed).length, [signals])

  const stats = useMemo(() => {
    const now = currentTime()
    const startOfDay = new Date(now).setHours(0, 0, 0, 0)
    const today = runs.filter((r) => new Date(r.startedAt).getTime() >= startOfDay).length
    const week = runs.filter((r) => now - new Date(r.startedAt).getTime() <= 7 * DAY).length
    const actions = runs.reduce(
      (n, r) => n + r.steps.filter((s) => s.status === "done" && s.action !== "evaluate" && s.action !== "rescore").length,
      0,
    )
    const completed = runs.filter((r) => r.status === "completed").length
    const failed = runs.filter((r) => r.status === "failed").length
    const decided = completed + failed
    return { today, week, actions, successRate: decided ? (completed / decided) * 100 : 0, completed, failed }
  }, [runs])

  return (
    <>
      <PageHeader
        title="Orchestration Agent"
        description="The agent watches signals, re-scores accounts and runs your playbooks — routing, drafting and enrolling automatically."
        actions={
          <>
            {pendingSignals > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  const n = processPending()
                  toast.success(`Processed ${n} pending signal${n === 1 ? "" : "s"}`)
                }}
              >
                <CpuIcon /> Process {pendingSignals} pending
              </Button>
            )}
            <Button onClick={() => showRun(simulateSignal(), "Simulated signal")}>
              <ShuffleIcon /> Simulate signal
            </Button>
          </>
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
              checked={autopilot}
              onCheckedChange={(on) => {
                setAutopilot(on)
                toast(on ? "Autopilot enabled" : "Autopilot paused", {
                  description: on ? "New signals will be processed automatically." : "New signals will queue until processed.",
                })
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Runs today" value={stats.today} icon={ActivityIcon} hint={`${stats.week} in the last 7 days`} />
        <StatCard label="Actions taken" value={stats.actions} icon={ZapIcon} hint={`across ${runs.length} runs`} />
        <StatCard
          label="Awaiting approval"
          value={pendingDrafts.length}
          icon={ClockIcon}
          hint={pendingDrafts.length ? "drafts need review" : "queue is clear"}
        />
        <StatCard
          label="Success rate"
          value={percent(stats.successRate, 0)}
          icon={CheckCircle2Icon}
          hint={`${stats.completed} completed · ${stats.failed} failed`}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v === "runs" ? null : v })} className="gap-4">
        <TabsList>
          <TabsTrigger value="runs">
            <ActivityIcon /> Activity
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <InboxIcon /> Approvals
            {pendingDrafts.length > 0 && (
              <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">{pendingDrafts.length}</Badge>
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
  const runs = useStore((s) => s.runs)
  const rules = useStore((s) => s.rules)
  const lookup = useLookup()
  const [status, setStatus] = useState<AgentRun["status"] | "all">("all")
  const [page, setPage] = useState(0)

  const ruleName = useMemo(() => new Map(rules.map((r) => [r.id, r.name])), [rules])
  const filtered = useMemo(
    () =>
      runs
        .filter((r) => status === "all" || r.status === status)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [runs, status],
  )
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of runs) m[r.status] = (m[r.status] ?? 0) + 1
    return m
  }, [runs])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

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
              setPage(0)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses ({runs.length})</SelectItem>
              {RUN_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "awaiting_approval" ? "Awaiting approval" : s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtered.length === 0 ? (
          <EmptyState icon={BotIcon} title="No agent runs" description="Simulate or ingest a signal to see the agent in action." />
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
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
                    const account = lookup.account(r.accountId)
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
                            (ruleName.get(r.ruleId) ?? <span className="text-muted-foreground">Deleted playbook</span>)
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
                {filtered.length} run{filtered.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  Page {current + 1} / {pageCount}
                </span>
                <Button variant="outline" size="icon-sm" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
                  <ChevronLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={current >= pageCount - 1}
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
  const runs = useStore((s) => s.runs)
  const rules = useStore((s) => s.rules)
  const signals = useStore((s) => s.signals)
  const drafts = useStore((s) => s.drafts)
  const lookup = useLookup()

  const run = useMemo(() => runs.find((r) => r.id === runId), [runs, runId])
  const rule = useMemo(() => rules.find((r) => r.id === run?.ruleId), [rules, run])
  const signal = useMemo(() => signals.find((s) => s.id === run?.signalId), [signals, run])
  const runDrafts = useMemo(() => drafts.filter((d) => d.runId === runId), [drafts, runId])
  const pending = runDrafts.find((d) => d.status === "pending")
  const reviewed = runDrafts.filter((d) => d.status !== "pending")
  const account = lookup.account(run?.accountId)

  return (
    <Sheet open={!!runId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl">
        {!run ? (
          <SheetHeader>
            <SheetTitle>Run not found</SheetTitle>
            <SheetDescription>This agent run no longer exists.</SheetDescription>
          </SheetHeader>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 pr-8">
                <SheetTitle>{rule?.name ?? (run.ruleId ? "Deleted playbook" : "Signal evaluation")}</SheetTitle>
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
  const drafts = useStore((s) => s.drafts)
  const lookup = useLookup()
  const [open, setOpen] = useState(false)

  const pending = useMemo(
    () => drafts.filter((d) => d.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [drafts],
  )
  const reviewed = useMemo(
    () => drafts.filter((d) => d.status !== "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
    [drafts],
  )

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title="All caught up"
          description="No drafts are waiting for review. Playbooks that require approval will queue drafts here."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pending.map((d) => (
            <DraftReviewCard key={d.id} draft={d} />
          ))}
        </div>
      )}

      <Collapsible open={open} onOpenChange={setOpen}>
        <Card className="gap-0 py-0">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
              <div>
                <div className="font-medium">Recently reviewed</div>
                <div className="text-sm text-muted-foreground">{reviewed.length} sent or rejected drafts</div>
              </div>
              <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Separator />
            {reviewed.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nothing reviewed yet.</p>
            ) : (
              <ul className="divide-y">
                {reviewed.map((d) => {
                  const account = lookup.account(d.accountId)
                  const contact = lookup.contact(d.contactId)
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                      {account && <CompanyAvatar name={account.name} />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{d.subject}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {account?.name ?? "Unknown"} · {contact ? fullName(contact) : "Unknown contact"} ·{" "}
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
                  )
                })}
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
  const rules = useStore((s) => s.rules)
  const sequences = useStore((s) => s.sequences)
  const updateRule = useStore((s) => s.updateRule)
  const deleteRule = useStore((s) => s.deleteRule)
  const [editing, setEditing] = useState<PlaybookRule | "new" | null>(null)

  const seqName = useMemo(() => new Map(sequences.map((s) => [s.id, s.name])), [sequences])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Playbooks are evaluated in order; the first enabled playbook whose trigger, minimum score and tiers match runs.
        </p>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon /> New playbook
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="No playbooks yet"
          description="Create a playbook to tell the agent what to do when signals arrive."
          action={
            <Button onClick={() => setEditing("new")}>
              <PlusIcon /> New playbook
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.map((r, i) => {
            const flow = [r.trigger === "any" ? "Any signal" : SIGNAL_LABELS[r.trigger], ...r.actions.map((a) => SHORT_ACTION[a])]
            return (
              <Card key={r.id} className={cn(!r.enabled && "opacity-70")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">#{i + 1}</span>
                    <span className="truncate">{r.name}</span>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">{r.description || "No description"}</CardDescription>
                  <CardAction>
                    <Switch
                      checked={r.enabled}
                      aria-label={r.enabled ? "Disable playbook" : "Enable playbook"}
                      onCheckedChange={(enabled) => {
                        updateRule(r.id, { enabled })
                        toast(enabled ? `“${r.name}” enabled` : `“${r.name}” disabled`)
                      }}
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
                    {r.sequenceId && seqName.get(r.sequenceId) ? (
                      <Link href={`/outreach/${r.sequenceId}`} className="truncate font-medium hover:underline">
                        {seqName.get(r.sequenceId)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <ConfirmDialog
                    title={`Delete “${r.name}”?`}
                    description="The agent will stop running this playbook. Past runs are kept."
                    confirmLabel="Delete"
                    onConfirm={() => {
                      deleteRule(r.id)
                      toast.success("Playbook deleted")
                    }}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Trash2Icon /> Delete
                      </Button>
                    }
                  />
                  <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                    <PencilIcon /> Edit
                  </Button>
                </CardFooter>
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

function PlaybookForm({ rule, onDone }: { rule?: PlaybookRule; onDone: () => void }) {
  const sequences = useStore((s) => s.sequences)
  const addRule = useStore((s) => s.addRule)
  const updateRule = useStore((s) => s.updateRule)

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
  const enabled = rule?.enabled ?? true

  const needsSequence = actions.includes("enroll_sequence") && sequenceId === NO_SEQ
  const [touched, setTouched] = useState(false)
  const errors = [
    !name.trim() && "Name is required.",
    tiers.length === 0 && "Select at least one tier.",
    needsSequence && "“Enroll in sequence” requires a sequence.",
  ].filter(Boolean) as string[]

  const toggleTier = (t: Tier, on: boolean) =>
    setTiers((cur) => (on ? ALL_TIERS.filter((x) => x === t || cur.includes(x)) : cur.filter((x) => x !== t)))
  const toggleAction = (a: AgentActionType, on: boolean) =>
    setActions((cur) => (on ? ACTION_KEYS.filter((x) => x === a || cur.includes(x)) : cur.filter((x) => x !== a)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (errors.length) return
    const payload = {
      name: name.trim(),
      description: description.trim(),
      trigger,
      minScore,
      tiers,
      actions: ACTION_KEYS.filter((a) => a === "rescore" || actions.includes(a)),
      sequenceId: sequenceId === NO_SEQ ? undefined : sequenceId,
      requireApproval,
      enabled,
    }
    if (rule) {
      updateRule(rule.id, payload)
      toast.success("Playbook updated", { description: payload.name })
    } else {
      addRule(payload)
      toast.success("Playbook created", { description: payload.name })
    }
    onDone()
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SEQ}>No sequence</SelectItem>
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
      {errors.length > 0 && (touched || errors.some((e) => !e.startsWith("Name"))) && (
        <ul className="list-inside list-disc text-sm text-destructive">
          {(touched ? errors : errors.filter((e) => !e.startsWith("Name"))).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={touched && errors.length > 0}>
          {rule ? "Save changes" : "Create playbook"}
        </Button>
      </DialogFooter>
    </form>
  )
}
