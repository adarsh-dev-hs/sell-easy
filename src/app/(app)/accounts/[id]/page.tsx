"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  ArrowLeftIcon,
  Building2Icon,
  CheckCircle2Icon,
  DollarSignIcon,
  ExternalLinkIcon,
  FlameIcon,
  GaugeIcon,
  HandshakeIcon,
  ListPlusIcon,
  Loader2Icon,
  MailCheckIcon,
  MergeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RadioTowerIcon,
  SparklesIcon,
  TargetIcon,
  Trash2Icon,
  UsersIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { AddAccountDialog, CreateDealDialog, EditAccountDialog, sellersOf } from "@/components/accounts/account-dialogs"
import { ActivityTimeline } from "@/components/accounts/activity-timeline"
import { AddContactDialog } from "@/components/contacts/add-contact-dialog"
import { ContactSheet } from "@/components/contacts/contact-sheet"
import { EnrollDialog } from "@/components/contacts/enroll-dialog"
import { CompanyAvatar, PersonAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryError, TableSkeleton } from "@/components/shared/query-state"
import { TierBadge } from "@/components/shared/score"
import { StatCard } from "@/components/shared/stat-card"
import { humanize, SignalIcon, StatusBadge } from "@/components/shared/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  type AccountDetail as AccountDetailRecord,
  ApiError,
  canWrite,
  useAccount,
  useAccountActivities,
  useAccountContacts,
  useAccountDeals,
  useAccountSignals,
  useAccountVersions,
  useAssignOwner,
  useCurrentUser,
  useDeleteAccount,
  useDismissDuplicate,
  useEnrichAccount,
  useIcp,
  useLogActivity,
  useMergeDuplicate,
  useProcessSignal,
  useRescoreAccount,
  useScoreBreakdown,
  useUpdateAccount,
  useUsers,
  useVerifyEmails,
} from "@/lib/api"
import { DEAL_STAGE_LABEL, SIGNAL_LABELS, STAGE_LABELS } from "@/lib/constants"
import { currency, dateTime, fullName, shortDate, timeAgo } from "@/lib/format"
import type { AccountStage, Activity } from "@/lib/types"
import { cn } from "@/lib/utils"

const UNASSIGNED = "__none__"

const historyChart = {
  score: { label: "Score", color: "var(--chart-1)" },
  fit: { label: "Fit", color: "var(--chart-2)" },
  intent: { label: "Intent", color: "var(--chart-3)" },
} satisfies ChartConfig

function TabSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <TableSkeleton rows={5} />
    </Card>
  )
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: account, error, isLoading, refetch } = useAccount(id)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-28" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (!account) {
    if (error && !(error instanceof ApiError && error.status === 404)) {
      return (
        <div className="space-y-4">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href="/accounts">
              <ArrowLeftIcon /> Accounts
            </Link>
          </Button>
          <QueryError error={error} onRetry={() => refetch()} title="Couldn't load account" />
        </div>
      )
    }
    return (
      <div className="py-10">
        <EmptyState
          icon={Building2Icon}
          title="Account not found"
          description="It may have been deleted or merged into another record."
          action={
            <Button asChild variant="outline">
              <Link href="/accounts">
                <ArrowLeftIcon /> Back to accounts
              </Link>
            </Button>
          }
        />
      </div>
    )
  }
  return <AccountDetail account={account} />
}

function AccountDetail({ account }: { account: AccountDetailRecord }) {
  const router = useRouter()
  const me = useCurrentUser()
  const writable = canWrite(me.role)
  const { data: users } = useUsers()
  const { data: contacts } = useAccountContacts(account.id)
  const { data: canonical } = useAccount(account.duplicateOf)
  const updateAccount = useUpdateAccount()
  const assignOwner = useAssignOwner()
  const enrichAccount = useEnrichAccount()
  const rescoreAccount = useRescoreAccount()
  const deleteAccount = useDeleteAccount()
  const mergeDuplicate = useMergeDuplicate()
  const dismissDuplicate = useDismissDuplicate()

  const [tab, setTab] = useState("overview")
  const [dealOpen, setDealOpen] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [addAccountOpen, setAddAccountOpen] = useState(false)

  const sellers = sellersOf(users)
  const { related } = account
  const prevScore = account.scoreHistory.at(-2)

  const enrich = () => {
    const toastId = toast.loading(`Enriching ${account.name}…`)
    enrichAccount.mutate(account.id, {
      onSuccess: (r) =>
        toast.success(`Enriched ${account.name} · score ${r.account.score}`, {
          id: toastId,
          description: r.sources.length ? `via ${r.sources.join(" → ")}` : undefined,
        }),
      onError: () => toast.dismiss(toastId),
    })
  }

  const rescore = () => {
    rescoreAccount.mutate(account.id, {
      onSuccess: ({ before, after }) => {
        const delta = after - before
        toast.success(`Score ${before} → ${after}`, {
          description: delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta} points`,
        })
      },
    })
  }

  const mergeIntoCanonical = () => {
    if (!account.duplicateOf) return
    const target = account.duplicateOf
    mergeDuplicate.mutate(account.id)
    router.push(`/accounts/${target}`)
  }

  return (
    <>
      {/* Header */}
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/accounts">
            <ArrowLeftIcon /> Accounts
          </Link>
        </Button>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <CompanyAvatar name={account.name} className="size-14 rounded-xl text-lg" />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{account.name}</h1>
                <TierBadge tier={account.tier} />
                {account.duplicateOf && <StatusBadge status="warning" label="Possible duplicate" />}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <a
                  href={`https://${account.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  {account.domain} <ExternalLinkIcon className="size-3" />
                </a>
                <span>·</span>
                <span>{account.industry}</span>
                <span>·</span>
                <span>{[account.city, account.country].filter(Boolean).join(", ")}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={account.stage}
              disabled={!writable || updateAccount.isPending}
              onValueChange={(v) =>
                updateAccount.mutate(
                  { id: account.id, stage: v as AccountStage },
                  { onSuccess: () => toast.success(`Stage set to ${STAGE_LABELS[v as AccountStage]}`) },
                )
              }
            >
              <SelectTrigger className="w-[140px]" aria-label="Stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STAGE_LABELS) as AccountStage[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={account.ownerId ?? UNASSIGNED}
              disabled={!writable || assignOwner.isPending}
              onValueChange={(v) => {
                const ownerId = v === UNASSIGNED ? null : v
                const name = users?.find((u) => u.id === ownerId)?.name
                assignOwner.mutate(
                  { ids: [account.id], ownerId },
                  { onSuccess: () => toast.success(ownerId ? `Assigned to ${name ?? "owner"}` : "Owner removed") },
                )
              }}
            >
              <SelectTrigger className="w-[160px]" aria-label="Owner">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {sellers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
                {/* Keep the current owner selectable even if inactive / a viewer */}
                {account.ownerId && !sellers.some((u) => u.id === account.ownerId) && (
                  <SelectItem value={account.ownerId} disabled>
                    {users?.find((u) => u.id === account.ownerId)?.name ?? "Unknown user"}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {writable && (
              <>
                <Button variant="outline" onClick={enrich} disabled={enrichAccount.isPending}>
                  {enrichAccount.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} Enrich
                </Button>
                <Button variant="outline" onClick={rescore} disabled={rescoreAccount.isPending}>
                  {rescoreAccount.isPending ? <Loader2Icon className="animate-spin" /> : <GaugeIcon />} Re-score
                </Button>
                <Button variant="outline" onClick={() => setEnrollOpen(true)}>
                  <ListPlusIcon /> Add to sequence
                </Button>
                <Button onClick={() => setDealOpen(true)}>
                  <HandshakeIcon /> Create deal
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="More actions">
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                      <PencilIcon /> Edit account
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setAddAccountOpen(true)}>
                      <PlusIcon /> New account
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                      <Trash2Icon /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
        {account.duplicateOf && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              This record shares a domain with{" "}
              {canonical ? (
                <Link href={`/accounts/${canonical.id}`} className="font-medium underline">
                  {canonical.name}
                </Link>
              ) : (
                "another account"
              )}
              . Review it in{" "}
              <Link href="/accounts" className="font-medium underline">
                Accounts → Duplicates
              </Link>
              .
            </div>
            {writable && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={dismissDuplicate.isPending}
                  onClick={() => dismissDuplicate.mutate(account.id)}
                >
                  <XIcon /> Not a duplicate
                </Button>
                <Button size="sm" disabled={!canonical || mergeDuplicate.isPending} onClick={() => setMergeOpen(true)}>
                  <MergeIcon /> Merge
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Score"
          value={account.score}
          icon={GaugeIcon}
          hint={prevScore ? `was ${prevScore.score} · Tier ${account.tier}` : `Tier ${account.tier}`}
        />
        <StatCard label="Fit" value={account.fitScore} icon={TargetIcon} hint="ICP match" />
        <StatCard label="Intent" value={account.intentScore} icon={FlameIcon} hint={`${related.signals} signals`} />
        <StatCard
          label="Open pipeline"
          value={currency(related.openPipeline)}
          icon={DollarSignIcon}
          hint={`${related.openDeals} open deal${related.openDeals === 1 ? "" : "s"}`}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">
              Contacts <Badge variant="secondary" className="h-4.5 px-1.5 text-[11px]">{related.contacts}</Badge>
            </TabsTrigger>
            <TabsTrigger value="signals">
              Signals <Badge variant="secondary" className="h-4.5 px-1.5 text-[11px]">{related.signals}</Badge>
            </TabsTrigger>
            <TabsTrigger value="deals">
              Deals <Badge variant="secondary" className="h-4.5 px-1.5 text-[11px]">{related.deals}</Badge>
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <OverviewTab account={account} onShowSignals={() => setTab("signals")} />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsTab accountId={account.id} writable={writable} />
        </TabsContent>
        <TabsContent value="signals">
          <SignalsTab accountId={account.id} writable={writable} />
        </TabsContent>
        <TabsContent value="deals">
          <DealsTab accountId={account.id} writable={writable} onCreate={() => setDealOpen(true)} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab accountId={account.id} writable={writable} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab accountId={account.id} />
        </TabsContent>
      </Tabs>

      {writable && (
        <>
          <CreateDealDialog account={account} open={dealOpen} onOpenChange={setDealOpen} />
          <EditAccountDialog account={account} open={editOpen} onOpenChange={setEditOpen} />
          <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} onCreated={(id) => router.push(`/accounts/${id}`)} />
          <EnrollDialog
            open={enrollOpen}
            onOpenChange={setEnrollOpen}
            target={{ kind: "account", accountId: account.id, choices: contacts ?? [] }}
          />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={`Delete ${account.name}?`}
            description={`This also removes ${related.contacts} contacts, ${related.deals} deals and ${related.signals} signals. This cannot be undone.`}
            confirmLabel="Delete account"
            onConfirm={() => {
              deleteAccount.mutate(account.id)
              router.push("/accounts")
            }}
          />
          <ConfirmDialog
            open={mergeOpen}
            onOpenChange={setMergeOpen}
            title={`Merge “${account.name}” into “${canonical?.name ?? "canonical record"}”?`}
            description="Contacts, signals and deals move to the canonical record and this duplicate is removed."
            confirmLabel="Merge"
            destructive={false}
            onConfirm={mergeIntoCanonical}
          />
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Overview

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{children || "—"}</dd>
    </div>
  )
}

function OverviewTab({ account, onShowSignals }: { account: AccountDetailRecord; onShowSignals: () => void }) {
  const { data: breakdown, isLoading, error, refetch } = useScoreBreakdown(account.id)
  const { data: icp } = useIcp()
  const contributors = breakdown?.contributors.slice(0, 6) ?? []

  const history = useMemo(
    () =>
      account.scoreHistory.map((p) => ({
        label: format(new Date(p.at), "MMM d"),
        score: p.score,
        fit: p.fit,
        intent: p.intent,
        reason: p.reason,
      })),
    [account.scoreHistory],
  )

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Firmographics</CardTitle>
            <CardDescription>
              {account.enrichedAt
                ? `Enriched ${timeAgo(account.enrichedAt)} via ${account.enrichmentSources.join(", ") || "manual entry"}`
                : "Not enriched yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <KV label="Industry">{account.industry}</KV>
              <KV label="Employees">{account.employees.toLocaleString()}</KV>
              <KV label="Revenue">{currency(account.revenue)}</KV>
              <KV label="Funding">{account.fundingStage}</KV>
              <KV label="Location">{[account.city, account.country].filter(Boolean).join(", ")}</KV>
              <KV label="Stage">{STAGE_LABELS[account.stage]}</KV>
              <KV label="Created">{shortDate(account.createdAt)}</KV>
              <KV label="Last updated">{timeAgo(account.updatedAt)}</KV>
              <KV label="LinkedIn">
                {account.linkedinUrl ? (
                  <a href={account.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                    Company page <ExternalLinkIcon className="size-3" />
                  </a>
                ) : null}
              </KV>
            </dl>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Description</div>
              <p className="text-sm leading-relaxed">{account.description || <span className="text-muted-foreground">No description. Enrich to fetch one.</span>}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Technologies</div>
                <div className="flex flex-wrap gap-1.5">
                  {account.technologies.length === 0 && <span className="text-sm text-muted-foreground">None detected</span>}
                  {account.technologies.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className={cn(icp?.technologies.includes(t) && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400")}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {account.tags.length === 0 && <span className="text-sm text-muted-foreground">No tags</span>}
                  {account.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Enrichment sources</div>
              <div className="flex flex-wrap gap-1.5">
                {account.enrichmentSources.length === 0 && <span className="text-sm text-muted-foreground">None</span>}
                {account.enrichmentSources.map((s) => (
                  <Badge key={s} variant="outline">
                    <SparklesIcon /> {s}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Score history</CardTitle>
            <CardDescription>
              {account.scoreHistory.length} scoring event{account.scoreHistory.length === 1 ? "" : "s"}
              {account.scoreHistory.at(-1) ? ` · latest: ${account.scoreHistory.at(-1)?.reason}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No scoring history yet.</p>
            ) : (
              <ChartContainer config={historyChart} className="h-64 w-full">
                <LineChart data={history} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(label, payload) => {
                          const reason = (payload?.[0]?.payload as { reason?: string } | undefined)?.reason
                          return reason ? `${label} · ${reason}` : String(label)
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line dataKey="score" type="monotone" stroke="var(--color-score)" strokeWidth={2.5} dot={{ r: 2 }} />
                  <Line dataKey="fit" type="monotone" stroke="var(--color-fit)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  <Line dataKey="intent" type="monotone" stroke="var(--color-intent)" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {error ? (
          <QueryError error={error} onRetry={() => refetch()} title="Couldn't load score breakdown" />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Score breakdown</CardTitle>
                <CardDescription>
                  {breakdown ? (
                    <>
                      Fit {breakdown.fitScore}/100 · weighted {breakdown.fitWeight}% fit / {100 - breakdown.fitWeight}% intent
                    </>
                  ) : (
                    <Skeleton className="h-4 w-48" />
                  )}
                </CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/scoring">ICP</Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading &&
                  [0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-1.5 w-full" />
                    </div>
                  ))}
                {breakdown?.fit.map((b) => (
                  <div key={b.label} className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      {b.matched ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircleIcon className="size-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{b.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {b.points}/{b.max}
                      </span>
                    </div>
                    <Progress value={b.max ? (b.points / b.max) * 100 : 0} className={cn("h-1.5", !b.matched && "opacity-60")} />
                    <div className="truncate text-xs text-muted-foreground">{b.detail}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Intent contributors</CardTitle>
                <CardDescription>
                  Intent {account.intentScore}
                  {breakdown ? ` · ${breakdown.intentDecayDays}-day half-life` : ""}
                </CardDescription>
                <CardAction>
                  <Button variant="ghost" size="sm" onClick={onShowSignals}>
                    All
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
                {breakdown && contributors.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recent signals contributing to intent.</p>
                )}
                {contributors.map(({ signal, points }) => (
                  <div key={signal.id} className="flex items-center gap-3">
                    <SignalIcon type={signal.type} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{signal.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {SIGNAL_LABELS[signal.type]} · {timeAgo(signal.occurredAt)}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-emerald-600 tabular-nums dark:text-emerald-400">+{points.toFixed(1)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Contacts

function ContactsTab({ accountId, writable }: { accountId: string; writable: boolean }) {
  const { data, isLoading, error, refetch } = useAccountContacts(accountId)
  const verifyEmails = useVerifyEmails()
  const rows = data ?? []
  const [selected, setSelected] = useState<string[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const selectedIds = selected.filter((id) => rows.some((r) => r.id === id))
  const allSel = rows.length > 0 && selectedIds.length === rows.length

  const verify = () => {
    const ids = selectedIds.length ? selectedIds : rows.filter((r) => r.emailStatus !== "verified").map((r) => r.id)
    if (ids.length === 0) {
      toast.info("All emails are already verified")
      return
    }
    verifyEmails.mutate(ids, {
      onSuccess: (r) =>
        toast.success(`Checked ${r.processed} email${r.processed === 1 ? "" : "s"}`, {
          description: `${r.verified} verified · ${r.invalid} invalid${r.found ? ` · ${r.found} found` : ""}`,
        }),
    })
  }

  if (isLoading) return <TabSkeleton />
  if (error) return <QueryError error={error} onRetry={() => refetch()} title="Couldn't load contacts" />

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="text-sm text-muted-foreground">
          {selectedIds.length ? `${selectedIds.length} selected` : `${rows.length} contacts`}
        </div>
        {writable && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={verify} disabled={verifyEmails.isPending || rows.length === 0}>
              {verifyEmails.isPending ? <Loader2Icon className="animate-spin" /> : <MailCheckIcon />}
              {selectedIds.length ? "Verify selected" : "Verify emails"}
            </Button>
            <Button variant="outline" size="sm" disabled={selectedIds.length === 0} onClick={() => setEnrollOpen(true)}>
              <ListPlusIcon /> Enroll selected
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <PlusIcon /> Add contact
            </Button>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={UsersIcon} title="No contacts yet" description="Add the people you want to reach at this account." />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {writable && (
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Select all"
                    checked={allSel ? true : selectedIds.length ? "indeterminate" : false}
                    onCheckedChange={(v) => setSelected(v === true ? rows.map((r) => r.id) : [])}
                  />
                </TableHead>
              )}
              <TableHead className={cn(!writable && "pl-4")}>Name</TableHead>
              <TableHead>Seniority</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4">Last contacted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const isSel = selectedIds.includes(c.id)
              return (
                <TableRow key={c.id} data-state={isSel ? "selected" : undefined} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                  {writable && (
                    <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`Select ${fullName(c)}`}
                        checked={isSel}
                        onCheckedChange={(v) => setSelected((p) => (v === true ? [...p, c.id] : p.filter((x) => x !== c.id)))}
                      />
                    </TableCell>
                  )}
                  <TableCell className={cn(!writable && "pl-4")}>
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={fullName(c)} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{fullName(c)}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.title}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.seniority}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <span className="truncate text-sm">{c.email || <span className="text-muted-foreground">—</span>}</span>
                      <StatusBadge status={c.emailStatus} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-xs text-muted-foreground">{timeAgo(c.lastContactedAt)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      {writable && (
        <>
          <AddContactDialog open={addOpen} onOpenChange={setAddOpen} accountId={accountId} />
          <EnrollDialog
            open={enrollOpen}
            onOpenChange={setEnrollOpen}
            target={{ kind: "contacts", contactIds: selectedIds }}
            onDone={() => setSelected([])}
          />
        </>
      )}
      <ContactSheet contactId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </Card>
  )
}

// ---------------------------------------------------------------- Signals

function SignalsTab({ accountId, writable }: { accountId: string; writable: boolean }) {
  const router = useRouter()
  const { data: rows, isLoading, error, refetch } = useAccountSignals(accountId)
  const processSignal = useProcessSignal()

  if (isLoading) return <TabSkeleton />
  if (error) return <QueryError error={error} onRetry={() => refetch()} title="Couldn't load signals" />
  if (!rows?.length)
    return <EmptyState icon={RadioTowerIcon} title="No signals yet" description="Intent, hiring, funding and web signals for this account will appear here." />

  const process = (id: string) =>
    processSignal.mutate(id, {
      onSuccess: (run) =>
        toast.success(`Agent ${run.status === "skipped" ? "evaluated" : "processed"} signal`, {
          description: `Score ${run.scoreBefore ?? "–"} → ${run.scoreAfter ?? "–"} · ${humanize(run.status)}`,
          action: { label: "View run", onClick: () => router.push(`/agent?run=${run.id}`) },
        }),
    })

  return (
    <Card className="gap-0 py-0">
      <CardContent className="divide-y p-0">
        {rows.map((s) => {
          const busy = processSignal.isPending && processSignal.variables === s.id
          return (
            <div key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 gap-3">
                <SignalIcon type={s.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.title}</span>
                    {s.processed ? (
                      <StatusBadge status="done" label="Processed" />
                    ) : (
                      <StatusBadge status="pending" label="Unprocessed" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{s.detail}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{SIGNAL_LABELS[s.type]}</span>
                    <span>via {s.source}</span>
                    {s.contact && (
                      <span>
                        {s.contact.firstName} {s.contact.lastName}
                      </span>
                    )}
                    <span title={dateTime(s.occurredAt)}>{timeAgo(s.occurredAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:w-auto">
                <div className="w-28 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Strength</span>
                    <span className="tabular-nums">{s.strength}</span>
                  </div>
                  <Progress value={s.strength} className="h-1.5" />
                </div>
                {writable && !s.processed && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => process(s.id)}>
                    {busy ? <Loader2Icon className="animate-spin" /> : <PlayIcon />} Process now
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- Deals

function DealsTab({ accountId, writable, onCreate }: { accountId: string; writable: boolean; onCreate: () => void }) {
  const { data: rows, isLoading, error, refetch } = useAccountDeals(accountId)
  const { data: users } = useUsers()

  if (isLoading) return <TabSkeleton />
  if (error) return <QueryError error={error} onRetry={() => refetch()} title="Couldn't load deals" />
  if (!rows?.length)
    return (
      <EmptyState
        icon={HandshakeIcon}
        title="No deals yet"
        description="Open an opportunity when this account is ready to buy."
        action={
          writable ? (
            <Button size="sm" onClick={onCreate}>
              <PlusIcon /> Create deal
            </Button>
          ) : undefined
        }
      />
    )

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Deal</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Probability</TableHead>
            <TableHead>Close date</TableHead>
            <TableHead className="pr-4">Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="pl-4">
                <Link href={`/pipeline?deal=${d.id}`} className="font-medium hover:underline">
                  {d.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {d.source}
                  {d.crmId ? ` · ${d.crmId}` : ""}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={d.stage} label={DEAL_STAGE_LABEL[d.stage]} tone={d.stage.startsWith("closed") ? undefined : "info"} />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{currency(d.amount, false)}</TableCell>
              <TableCell className="tabular-nums">{d.probability}%</TableCell>
              <TableCell>{shortDate(d.closeDate)}</TableCell>
              <TableCell className="pr-4">{users?.find((u) => u.id === d.ownerId)?.name ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {writable && (
        <div className="flex justify-end border-t px-4 py-3">
          <Button size="sm" variant="outline" onClick={onCreate}>
            <PlusIcon /> Create deal
          </Button>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- Activity

const LOG_TYPES: { id: Activity["type"]; label: string }[] = [
  { id: "note", label: "Note" },
  { id: "call", label: "Call" },
  { id: "meeting", label: "Meeting" },
  { id: "email", label: "Email" },
]

function ActivityTab({ accountId, writable }: { accountId: string; writable: boolean }) {
  const { data, isLoading, error, refetch } = useAccountActivities(accountId)
  const logActivity = useLogActivity()
  const [type, setType] = useState<Activity["type"]>("note")
  const [title, setTitle] = useState("")
  const [detail, setDetail] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || logActivity.isPending) return
    logActivity.mutate(
      { accountId, type, title: title.trim(), detail: detail.trim() || undefined },
      {
        onSuccess: () => {
          setTitle("")
          setDetail("")
        },
      },
    )
  }

  const rows = data?.data ?? []
  const total = data?.meta.total ?? 0

  return (
    <div className={cn("grid gap-4", writable && "lg:grid-cols-3")}>
      {writable && (
        <Card className="h-fit lg:order-2">
          <CardHeader>
            <CardTitle>Log activity</CardTitle>
            <CardDescription>Record a call, meeting or note against this account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <Select value={type} onValueChange={(v) => setType(v as Activity["type"])}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOG_TYPES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="act-title">Title</FieldLabel>
                  <Input id="act-title" required placeholder="Intro call with VP Sales" value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="act-detail">Details</FieldLabel>
                  <Textarea id="act-detail" rows={4} placeholder="Key takeaways, next steps…" value={detail} onChange={(e) => setDetail(e.target.value)} />
                </Field>
                <Button type="submit" disabled={!title.trim() || logActivity.isPending}>
                  {logActivity.isPending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Log activity
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}
      <Card className={cn(writable && "lg:order-1 lg:col-span-2")}>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            {isLoading ? "Loading…" : total > rows.length ? `Latest ${rows.length} of ${total} events` : `${total} events`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <QueryError error={error} onRetry={() => refetch()} title="Couldn't load activity" />
          ) : (
            <ActivityTimeline items={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- History

function HistoryTab({ accountId }: { accountId: string }) {
  const { data: versions, isLoading, error, refetch } = useAccountVersions(accountId)
  if (isLoading) return <TabSkeleton />
  if (error) return <QueryError error={error} onRetry={() => refetch()} title="Couldn't load version history" />
  if (!versions?.length) return <EmptyState title="No versions recorded" />
  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <Card key={v.version} className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
            <Badge variant="outline" className="font-mono">
              v{v.version}
            </Badge>
            <span className="text-sm font-medium">{v.source}</span>
            <span className="ml-auto text-xs text-muted-foreground" title={dateTime(v.at)}>
              {dateTime(v.at)} · {timeAgo(v.at)}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40 pl-4">Field</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="pr-4">To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.changes.map((c, i) => (
                <TableRow key={`${c.field}-${i}`}>
                  <TableCell className="pl-4 font-mono text-xs">{c.field}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground line-through decoration-muted-foreground/40" title={c.from}>
                    {c.from || "—"}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate pr-4" title={c.to}>
                    {c.to || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  )
}
