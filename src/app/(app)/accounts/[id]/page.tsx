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
} from "lucide-react"
import { toast } from "sonner"
import { AddAccountDialog, CreateDealDialog, EditAccountDialog } from "@/components/accounts/account-dialogs"
import { ActivityTimeline } from "@/components/accounts/activity-timeline"
import { AddContactDialog } from "@/components/contacts/add-contact-dialog"
import { ContactSheet } from "@/components/contacts/contact-sheet"
import { EnrollDialog } from "@/components/contacts/enroll-dialog"
import { CompanyAvatar, PersonAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { DEAL_STAGE_LABEL, SIGNAL_LABELS, STAGE_LABELS } from "@/lib/constants"
import { currency, dateTime, fullName, shortDate, timeAgo } from "@/lib/format"
import { fitBreakdown } from "@/lib/scoring"
import { useLookup, useStore } from "@/lib/store"
import type { Account, AccountStage, Activity } from "@/lib/types"
import { cn } from "@/lib/utils"

const UNASSIGNED = "__none__"

const historyChart = {
  score: { label: "Score", color: "var(--chart-1)" },
  fit: { label: "Fit", color: "var(--chart-2)" },
  intent: { label: "Intent", color: "var(--chart-3)" },
} satisfies ChartConfig

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const accounts = useStore((s) => s.accounts)
  const account = useMemo(() => accounts.find((a) => a.id === id), [accounts, id])

  if (!account) {
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

function AccountDetail({ account }: { account: Account }) {
  const router = useRouter()
  const lookup = useLookup()
  const users = useStore((s) => s.users)
  const contacts = useStore((s) => s.contacts)
  const deals = useStore((s) => s.deals)
  const signals = useStore((s) => s.signals)
  const updateAccount = useStore((s) => s.updateAccount)
  const assignOwner = useStore((s) => s.assignOwner)
  const enrichAccounts = useStore((s) => s.enrichAccounts)
  const rescoreAccount = useStore((s) => s.rescoreAccount)
  const deleteAccounts = useStore((s) => s.deleteAccounts)

  const [tab, setTab] = useState("overview")
  const [enriching, setEnriching] = useState(false)
  const [dealOpen, setDealOpen] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addAccountOpen, setAddAccountOpen] = useState(false)

  const sellers = useMemo(() => users.filter((u) => u.status === "active" && u.role !== "viewer"), [users])
  const accountContacts = useMemo(() => contacts.filter((c) => c.accountId === account.id), [contacts, account.id])
  const accountDeals = useMemo(() => deals.filter((d) => d.accountId === account.id), [deals, account.id])
  const accountSignals = useMemo(
    () => signals.filter((s) => s.accountId === account.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [signals, account.id],
  )
  const openDeals = accountDeals.filter((d) => !d.stage.startsWith("closed"))
  const openPipeline = openDeals.reduce((s, d) => s + d.amount, 0)
  const prevScore = account.scoreHistory.at(-2)
  const canonical = account.duplicateOf ? lookup.account(account.duplicateOf) : undefined

  const enrich = () => {
    setEnriching(true)
    const p = enrichAccounts([account.id]).finally(() => setEnriching(false))
    toast.promise(p, {
      loading: `Enriching ${account.name} via Clearbit → FullEnrich…`,
      success: () => {
        const a = useStore.getState().accounts.find((x) => x.id === account.id)
        return `Enriched ${account.name}${a ? ` · score ${a.score}` : ""}`
      },
      error: "Enrichment failed",
    })
  }

  const rescore = () => {
    const { before, after } = rescoreAccount(account.id, "Manual re-score")
    const delta = after - before
    toast.success(`Score ${before} → ${after}`, {
      description: delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta} points`,
    })
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
              onValueChange={(v) => {
                updateAccount(account.id, { stage: v as AccountStage }, "Stage change")
                toast.success(`Stage set to ${STAGE_LABELS[v as AccountStage]}`)
              }}
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
              onValueChange={(v) => {
                const ownerId = v === UNASSIGNED ? null : v
                assignOwner([account.id], ownerId)
                toast.success(ownerId ? `Assigned to ${lookup.user(ownerId)?.name}` : "Owner removed")
              }}
            >
              <SelectTrigger className="w-[160px]" aria-label="Owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {sellers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={enrich} disabled={enriching}>
              {enriching ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} Enrich
            </Button>
            <Button variant="outline" onClick={rescore}>
              <GaugeIcon /> Re-score
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
          </div>
        </div>
        {canonical && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            This record shares a domain with{" "}
            <Link href={`/accounts/${canonical.id}`} className="font-medium underline">
              {canonical.name}
            </Link>
            . Review it in{" "}
            <Link href="/accounts" className="font-medium underline">
              Accounts → Duplicates
            </Link>
            .
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
        <StatCard label="Intent" value={account.intentScore} icon={FlameIcon} hint={`${accountSignals.length} signals`} />
        <StatCard
          label="Open pipeline"
          value={currency(openPipeline)}
          icon={DollarSignIcon}
          hint={`${openDeals.length} open deal${openDeals.length === 1 ? "" : "s"}`}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">
              Contacts <Badge variant="secondary" className="h-4.5 px-1.5 text-[11px]">{accountContacts.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="signals">
              Signals <Badge variant="secondary" className="h-4.5 px-1.5 text-[11px]">{accountSignals.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="deals">
              Deals <Badge variant="secondary" className="h-4.5 px-1.5 text-[11px]">{accountDeals.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <OverviewTab account={account} onShowSignals={() => setTab("signals")} />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsTab account={account} />
        </TabsContent>
        <TabsContent value="signals">
          <SignalsTab account={account} />
        </TabsContent>
        <TabsContent value="deals">
          <DealsTab account={account} onCreate={() => setDealOpen(true)} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab account={account} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab account={account} />
        </TabsContent>
      </Tabs>

      <CreateDealDialog account={account} open={dealOpen} onOpenChange={setDealOpen} />
      <EditAccountDialog account={account} open={editOpen} onOpenChange={setEditOpen} />
      <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} onCreated={(id) => router.push(`/accounts/${id}`)} />
      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        choices={accountContacts}
        contactIds={accountContacts
          .filter((c) => !["unsubscribed", "bounced"].includes(c.status) && c.emailStatus !== "invalid")
          .map((c) => c.id)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${account.name}?`}
        description={`This also removes ${accountContacts.length} contacts, ${accountDeals.length} deals and ${accountSignals.length} signals. This cannot be undone.`}
        confirmLabel="Delete account"
        onConfirm={() => {
          const name = account.name
          router.push("/accounts")
          deleteAccounts([account.id])
          toast.success(`Deleted ${name}`)
        }}
      />
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

function OverviewTab({ account, onShowSignals }: { account: Account; onShowSignals: () => void }) {
  const icp = useStore((s) => s.icp)
  const signals = useStore((s) => s.signals)
  const breakdown = useMemo(() => fitBreakdown(account, icp), [account, icp])
  const fitTotal = breakdown.reduce((s, b) => s + b.points, 0)

  const [now] = useState(() => Date.now())
  const contributors = useMemo(() => {
    return signals
      .filter((s) => s.accountId === account.id)
      .map((s) => {
        const ageDays = (now - new Date(s.occurredAt).getTime()) / 86_400_000
        const expired = ageDays > icp.intentDecayDays * 3
        const decay = Math.pow(0.5, ageDays / icp.intentDecayDays)
        const weight = (icp.signalWeights[s.type] ?? 50) / 100
        return { signal: s, points: expired ? 0 : s.strength * weight * decay * 0.45, expired }
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 6)
  }, [signals, account.id, icp, now])

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
                      className={cn(icp.technologies.includes(t) && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400")}
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
        <Card>
          <CardHeader>
            <CardTitle>Score breakdown</CardTitle>
            <CardDescription>
              Fit {fitTotal}/100 · weighted {icp.fitWeight}% fit / {100 - icp.fitWeight}% intent
            </CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/scoring">ICP</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            {breakdown.map((b) => (
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
                <Progress value={(b.points / b.max) * 100} className={cn("h-1.5", !b.matched && "opacity-60")} />
                <div className="truncate text-xs text-muted-foreground">{b.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Intent contributors</CardTitle>
            <CardDescription>
              Intent {account.intentScore} · {icp.intentDecayDays}-day half-life
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={onShowSignals}>
                All
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {contributors.length === 0 && <p className="text-sm text-muted-foreground">No signals for this account yet.</p>}
            {contributors.map(({ signal, points, expired }) => (
              <div key={signal.id} className="flex items-center gap-3">
                <SignalIcon type={signal.type} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{signal.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {SIGNAL_LABELS[signal.type]} · {timeAgo(signal.occurredAt)}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    expired ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {expired ? "expired" : `+${points.toFixed(1)}`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Contacts

function ContactsTab({ account }: { account: Account }) {
  const contacts = useStore((s) => s.contacts)
  const verifyEmails = useStore((s) => s.verifyEmails)
  const rows = useMemo(() => contacts.filter((c) => c.accountId === account.id), [contacts, account.id])
  const [selected, setSelected] = useState<string[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const selectedIds = selected.filter((id) => rows.some((r) => r.id === id))
  const allSel = rows.length > 0 && selectedIds.length === rows.length

  const verify = async () => {
    const ids = selectedIds.length ? selectedIds : rows.filter((r) => r.emailStatus !== "verified").map((r) => r.id)
    if (ids.length === 0) {
      toast.info("All emails are already verified")
      return
    }
    setVerifying(true)
    try {
      await verifyEmails(ids)
      const after = useStore.getState().contacts.filter((c) => ids.includes(c.id))
      const ok = after.filter((c) => c.emailStatus === "verified").length
      toast.success(`Checked ${ids.length} email${ids.length === 1 ? "" : "s"}`, {
        description: `${ok} verified · ${ids.length - ok} invalid`,
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="text-sm text-muted-foreground">
          {selectedIds.length ? `${selectedIds.length} selected` : `${rows.length} contacts`}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={verify} disabled={verifying || rows.length === 0}>
            {verifying ? <Loader2Icon className="animate-spin" /> : <MailCheckIcon />}
            {selectedIds.length ? "Verify selected" : "Verify emails"}
          </Button>
          <Button variant="outline" size="sm" disabled={selectedIds.length === 0} onClick={() => setEnrollOpen(true)}>
            <ListPlusIcon /> Enroll selected
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon /> Add contact
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={UsersIcon} title="No contacts yet" description="Add the people you want to reach at this account." />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  aria-label="Select all"
                  checked={allSel ? true : selectedIds.length ? "indeterminate" : false}
                  onCheckedChange={(v) => setSelected(v === true ? rows.map((r) => r.id) : [])}
                />
              </TableHead>
              <TableHead>Name</TableHead>
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
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${fullName(c)}`}
                      checked={isSel}
                      onCheckedChange={(v) => setSelected((p) => (v === true ? [...p, c.id] : p.filter((x) => x !== c.id)))}
                    />
                  </TableCell>
                  <TableCell>
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
      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} accountId={account.id} />
      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} contactIds={selectedIds} onDone={() => setSelected([])} />
      <ContactSheet contactId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </Card>
  )
}

// ---------------------------------------------------------------- Signals

function SignalsTab({ account }: { account: Account }) {
  const router = useRouter()
  const signals = useStore((s) => s.signals)
  const processSignal = useStore((s) => s.processSignal)
  const rows = useMemo(
    () => signals.filter((s) => s.accountId === account.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [signals, account.id],
  )

  if (rows.length === 0)
    return <EmptyState icon={RadioTowerIcon} title="No signals yet" description="Intent, hiring, funding and web signals for this account will appear here." />

  return (
    <Card className="gap-0 py-0">
      <CardContent className="divide-y p-0">
        {rows.map((s) => (
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
              {!s.processed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const run = processSignal(s.id)
                    toast.success(`Agent ${run.status === "skipped" ? "evaluated" : "processed"} signal`, {
                      description: `Score ${run.scoreBefore} → ${run.scoreAfter} · ${humanize(run.status)}`,
                      action: { label: "View run", onClick: () => router.push(`/agent?run=${run.id}`) },
                    })
                  }}
                >
                  <PlayIcon /> Process now
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- Deals

function DealsTab({ account, onCreate }: { account: Account; onCreate: () => void }) {
  const deals = useStore((s) => s.deals)
  const lookup = useLookup()
  const rows = useMemo(() => deals.filter((d) => d.accountId === account.id), [deals, account.id])

  if (rows.length === 0)
    return (
      <EmptyState
        icon={HandshakeIcon}
        title="No deals yet"
        description="Open an opportunity when this account is ready to buy."
        action={
          <Button size="sm" onClick={onCreate}>
            <PlusIcon /> Create deal
          </Button>
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
              <TableCell className="pr-4">{lookup.user(d.ownerId)?.name ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end border-t px-4 py-3">
        <Button size="sm" variant="outline" onClick={onCreate}>
          <PlusIcon /> Create deal
        </Button>
      </div>
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

function ActivityTab({ account }: { account: Account }) {
  const activities = useStore((s) => s.activities)
  const addNote = useStore((s) => s.addNote)
  const rows = useMemo(() => activities.filter((a) => a.accountId === account.id), [activities, account.id])
  const [type, setType] = useState<Activity["type"]>("note")
  const [title, setTitle] = useState("")
  const [detail, setDetail] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    addNote({ accountId: account.id, type, title: title.trim(), detail: detail.trim() || undefined })
    toast.success(`${LOG_TYPES.find((t) => t.id === type)?.label} logged`)
    setTitle("")
    setDetail("")
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
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
              <Button type="submit" disabled={!title.trim()}>
                <PlusIcon /> Log activity
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card className="lg:order-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>{rows.length} events</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityTimeline items={rows} />
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- History

function HistoryTab({ account }: { account: Account }) {
  const versions = useMemo(() => [...account.versions].sort((a, b) => b.version - a.version), [account.versions])
  if (versions.length === 0) return <EmptyState title="No versions recorded" />
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
