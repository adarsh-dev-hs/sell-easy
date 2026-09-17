"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowRightIcon,
  Building2Icon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  GaugeIcon,
  ListPlusIcon,
  Loader2Icon,
  MergeIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { AddAccountDialog } from "@/components/accounts/account-dialogs"
import { BulkBar, nextSort, SortButton, type SortDir, TablePagination } from "@/components/accounts/table-kit"
import { EnrollDialog } from "@/components/contacts/enroll-dialog"
import { CompanyAvatar, OwnerLabel, UserAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ScoreBar, ScoreCell, TierBadge } from "@/components/shared/score"
import { StatusBadge } from "@/components/shared/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { INDUSTRIES, STAGE_LABELS } from "@/lib/constants"
import { shortDate, timeAgo } from "@/lib/format"
import { useCurrentUser, useLookup, useStore } from "@/lib/store"
import type { Account, AccountStage, Tier } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20
const ALL = "all"
const UNASSIGNED = "__none__"

type View = "all" | "mine" | "unassigned" | "duplicates"
type SortKey = "name" | "score" | "intent" | "employees" | "updated"

const sorters: Record<SortKey, (a: Account, b: Account) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  score: (a, b) => a.score - b.score,
  intent: (a, b) => a.intentScore - b.intentScore,
  employees: (a, b) => a.employees - b.employees,
  updated: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
}

export default function AccountsPageWrapper() {
  return (
    <Suspense>
      <AccountsPage />
    </Suspense>
  )
}

function AccountsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const me = useCurrentUser()
  const lookup = useLookup()
  const accounts = useStore((s) => s.accounts)
  const contacts = useStore((s) => s.contacts)
  const users = useStore((s) => s.users)
  const enrichAccounts = useStore((s) => s.enrichAccounts)
  const rescoreAccount = useStore((s) => s.rescoreAccount)
  const assignOwner = useStore((s) => s.assignOwner)
  const deleteAccounts = useStore((s) => s.deleteAccounts)

  const [view, setView] = useState<View>("all")
  const [search, setSearch] = useState("")
  const [tier, setTier] = useState(ALL)
  const [industry, setIndustry] = useState(ALL)
  const [stage, setStage] = useState(ALL)
  const [owner, setOwner] = useState(ALL)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "score", dir: "desc" })
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [enriching, setEnriching] = useState<string[]>([])
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [addOpenManual, setAddOpenManual] = useState(false)

  // `?new=1` opens the add dialog (e.g. from the command menu)
  const wantsNew = searchParams.get("new") === "1"
  const addOpen = addOpenManual || wantsNew
  const setAddOpen = (open: boolean) => {
    setAddOpenManual(open)
    if (!open && wantsNew) router.replace("/accounts")
  }

  const sellers = useMemo(() => users.filter((u) => u.status === "active" && u.role !== "viewer"), [users])
  const canonical = useMemo(() => accounts.filter((a) => !a.duplicateOf), [accounts])
  const duplicates = useMemo(() => accounts.filter((a) => a.duplicateOf), [accounts])
  const industries = useMemo(
    () => Array.from(new Set([...INDUSTRIES, ...canonical.map((a) => a.industry)])).sort(),
    [canonical],
  )

  const counts = useMemo(
    () => ({
      all: canonical.length,
      mine: canonical.filter((a) => a.ownerId === me.id).length,
      unassigned: canonical.filter((a) => !a.ownerId).length,
      duplicates: duplicates.length,
    }),
    [canonical, duplicates, me.id],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = canonical.filter((a) => {
      if (view === "mine" && a.ownerId !== me.id) return false
      if (view === "unassigned" && a.ownerId) return false
      if (q && !a.name.toLowerCase().includes(q) && !a.domain.toLowerCase().includes(q)) return false
      if (tier !== ALL && a.tier !== tier) return false
      if (industry !== ALL && a.industry !== industry) return false
      if (stage !== ALL && a.stage !== stage) return false
      if (owner === UNASSIGNED && a.ownerId) return false
      if (owner !== ALL && owner !== UNASSIGNED && a.ownerId !== owner) return false
      return true
    })
    const cmp = sorters[sort.key]
    return rows.sort((a, b) => (sort.dir === "asc" ? cmp(a, b) : cmp(b, a)))
  }, [canonical, view, me.id, search, tier, industry, stage, owner, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // Drop selections that no longer exist (deleted / merged)
  const selectedIds = useMemo(() => {
    const ids = new Set(accounts.map((a) => a.id))
    return selected.filter((id) => ids.has(id))
  }, [selected, accounts])

  const selectedContactIds = useMemo(() => {
    const set = new Set(selectedIds)
    return contacts.filter((c) => set.has(c.accountId)).map((c) => c.id)
  }, [contacts, selectedIds])

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(0)
  }

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selectedIds.includes(r.id))
  const someOnPage = pageRows.some((r) => selectedIds.includes(r.id))
  const togglePage = (on: boolean) => {
    const ids = pageRows.map((r) => r.id)
    setSelected((prev) => (on ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id))))
  }
  const toggleRow = (id: string, on: boolean) => setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))

  const hasFilters = search || tier !== ALL || industry !== ALL || stage !== ALL || owner !== ALL
  const clearFilters = () => {
    setSearch("")
    setTier(ALL)
    setIndustry(ALL)
    setStage(ALL)
    setOwner(ALL)
    setPage(0)
  }

  // ------------------------------------------------ actions
  const runEnrich = (ids: string[]) => {
    if (ids.length === 0) return
    setEnriching((prev) => [...prev, ...ids])
    const label = ids.length === 1 ? (lookup.account(ids[0])?.name ?? "account") : `${ids.length} accounts`
    const p = enrichAccounts(ids).finally(() => setEnriching((prev) => prev.filter((id) => !ids.includes(id))))
    toast.promise(p, {
      loading: `Enriching ${label} via Clearbit → FullEnrich…`,
      success: `Enriched ${label}`,
      error: "Enrichment failed",
    })
  }

  const runRescore = (ids: string[]) => {
    if (ids.length === 1) {
      const { before, after } = rescoreAccount(ids[0], "Manual re-score")
      toast.success(`Re-scored ${lookup.account(ids[0])?.name}`, { description: `Score ${before} → ${after}` })
      return
    }
    let changed = 0
    ids.forEach((id) => {
      const r = rescoreAccount(id, "Manual re-score")
      if (r.before !== r.after) changed++
    })
    toast.success(`Re-scored ${ids.length} accounts`, { description: `${changed} score${changed === 1 ? "" : "s"} changed` })
  }

  const runAssign = (ids: string[], ownerId: string | null) => {
    assignOwner(ids, ownerId)
    const name = ownerId ? lookup.user(ownerId)?.name : "Unassigned"
    toast.success(
      ids.length === 1 ? `${lookup.account(ids[0])?.name} → ${name}` : `Assigned ${ids.length} accounts to ${name}`,
    )
  }

  const confirmDelete = () => {
    if (!deleteIds) return
    const label = deleteIds.length === 1 ? lookup.account(deleteIds[0])?.name : `${deleteIds.length} accounts`
    deleteAccounts(deleteIds)
    setSelected((prev) => prev.filter((id) => !deleteIds.includes(id)))
    toast.success(`Deleted ${label}`)
    setDeleteIds(null)
  }

  const bulkBusy = selectedIds.some((id) => enriching.includes(id))

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Every company in your TAM, enriched, de-duplicated and scored against your ICP."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon /> Add account
          </Button>
        }
      />

      <Tabs
        value={view}
        onValueChange={(v) => {
          setView(v as View)
          setPage(0)
        }}
      >
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">
            All <CountBadge n={counts.all} />
          </TabsTrigger>
          <TabsTrigger value="mine">
            My accounts <CountBadge n={counts.mine} />
          </TabsTrigger>
          <TabsTrigger value="unassigned">
            Unassigned <CountBadge n={counts.unassigned} />
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            Duplicates <CountBadge n={counts.duplicates} highlight={counts.duplicates > 0} />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "duplicates" ? (
        <DuplicatesView duplicates={duplicates} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name or domain…"
                className="pl-8"
                value={search}
                onChange={(e) => resetPage(setSearch)(e.target.value)}
              />
            </div>
            <FilterSelect value={tier} onChange={resetPage(setTier)} placeholder="Tier" allLabel="All tiers" className="w-[120px]">
              {(["A", "B", "C", "D"] as Tier[]).map((t) => (
                <SelectItem key={t} value={t}>
                  Tier {t}
                </SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect value={industry} onChange={resetPage(setIndustry)} placeholder="Industry" allLabel="All industries">
              {industries.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect value={stage} onChange={resetPage(setStage)} placeholder="Stage" allLabel="All stages">
              {(Object.keys(STAGE_LABELS) as AccountStage[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect value={owner} onChange={resetPage(setOwner)} placeholder="Owner" allLabel="All owners">
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {sellers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </FilterSelect>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <XIcon /> Reset
              </Button>
            )}
          </div>

          <BulkBar count={selectedIds.length} onClear={() => setSelected([])}>
            <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => runEnrich(selectedIds)}>
              {bulkBusy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} Enrich
            </Button>
            <Button variant="outline" size="sm" onClick={() => runRescore(selectedIds)}>
              <GaugeIcon /> Re-score
            </Button>
            <Select value="" onValueChange={(v) => runAssign(selectedIds, v === UNASSIGNED ? null : v)}>
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue placeholder="Assign owner" />
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedContactIds.length === 0) {
                  toast.error("The selected accounts have no contacts")
                  return
                }
                setEnrollOpen(true)
              }}
            >
              <ListPlusIcon /> Add {selectedContactIds.length} contacts to sequence
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteIds(selectedIds)}>
              <Trash2Icon /> Delete
            </Button>
          </BulkBar>

          <Card className="gap-0 overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      aria-label="Select page"
                      checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                      onCheckedChange={(v) => togglePage(v === true)}
                    />
                  </TableHead>
                  <TableHead className="min-w-[220px]">
                    <SortButton label="Company" column="name" sort={sort} onSort={(k) => setSort((p) => nextSort(p, k, "asc"))} />
                  </TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>
                    <SortButton label="Employees" column="employees" sort={sort} onSort={(k) => setSort((p) => nextSort(p, k))} />
                  </TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>
                    <SortButton label="Score" column="score" sort={sort} onSort={(k) => setSort((p) => nextSort(p, k))} />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Intent" column="intent" sort={sort} onSort={(k) => setSort((p) => nextSort(p, k))} />
                  </TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>
                    <SortButton label="Updated" column="updated" sort={sort} onSort={(k) => setSort((p) => nextSort(p, k))} />
                  </TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="p-6">
                      <EmptyState
                        icon={Building2Icon}
                        title="No accounts match"
                        description="Try a different search or clear your filters."
                        action={
                          hasFilters ? (
                            <Button variant="outline" size="sm" onClick={clearFilters}>
                              Clear filters
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => setAddOpen(true)}>
                              <PlusIcon /> Add account
                            </Button>
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
                {pageRows.map((a) => {
                  const isSel = selectedIds.includes(a.id)
                  const isEnriching = enriching.includes(a.id)
                  return (
                    <TableRow key={a.id} data-state={isSel ? "selected" : undefined}>
                      <TableCell className="pl-4">
                        <Checkbox aria-label={`Select ${a.name}`} checked={isSel} onCheckedChange={(v) => toggleRow(a.id, v === true)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <CompanyAvatar name={a.name} />
                          <div className="min-w-0">
                            <Link href={`/accounts/${a.id}`} className="block truncate font-medium hover:underline">
                              {a.name}
                            </Link>
                            <div className="truncate text-xs text-muted-foreground">{a.domain}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.industry}</TableCell>
                      <TableCell className="tabular-nums">{a.employees.toLocaleString()}</TableCell>
                      <TableCell>
                        <TierBadge tier={a.tier} />
                      </TableCell>
                      <TableCell>
                        <ScoreCell score={a.score} fit={a.fitScore} intent={a.intentScore} />
                      </TableCell>
                      <TableCell>
                        <ScoreBar value={a.intentScore} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.stage} label={STAGE_LABELS[a.stage]} />
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <OwnerLabel user={lookup.user(a.ownerId)} />
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {isEnriching ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Loader2Icon className="size-3 animate-spin" /> Enriching…
                          </span>
                        ) : (
                          <>
                            <div>{timeAgo(a.updatedAt)}</div>
                            <div className="text-[11px]">Enriched {a.enrichedAt ? timeAgo(a.enrichedAt) : "never"}</div>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onSelect={() => router.push(`/accounts/${a.id}`)}>
                              <EyeIcon /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={isEnriching} onSelect={() => runEnrich([a.id])}>
                              <SparklesIcon /> Enrich
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => runRescore([a.id])}>
                              <GaugeIcon /> Re-score
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <UserRoundIcon /> Assign owner
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-48">
                                <DropdownMenuLabel>Owner</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => runAssign([a.id], null)}>
                                  <UserAvatar user={null} className="size-5" /> Unassigned
                                  {!a.ownerId && <CheckIcon className="ml-auto" />}
                                </DropdownMenuItem>
                                {sellers.map((u) => (
                                  <DropdownMenuItem key={u.id} onSelect={() => runAssign([a.id], u.id)}>
                                    <UserAvatar user={u} className="size-5" /> {u.name}
                                    {a.ownerId === u.id && <CheckIcon className="ml-auto" />}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteIds([a.id])}>
                              <Trash2Icon /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <TablePagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </Card>
        </div>
      )}

      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} />
      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        contactIds={selectedContactIds}
        onDone={() => setSelected([])}
      />
      <ConfirmDialog
        open={!!deleteIds}
        onOpenChange={(o) => !o && setDeleteIds(null)}
        title={
          deleteIds?.length === 1
            ? `Delete ${lookup.account(deleteIds[0])?.name ?? "account"}?`
            : `Delete ${deleteIds?.length ?? 0} accounts?`
        }
        description="This also removes their contacts, deals, signals and drafts. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </>
  )
}

function CountBadge({ n, highlight }: { n: number; highlight?: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-4.5 min-w-5 px-1.5 text-[11px] tabular-nums",
        highlight && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      )}
    >
      {n}
    </Badge>
  )
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  allLabel,
  className,
  children,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  allLabel: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-[150px]", value !== ALL && "border-primary/40", className)} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------- Duplicates

function DuplicatesView({ duplicates }: { duplicates: Account[] }) {
  const lookup = useLookup()
  const contacts = useStore((s) => s.contacts)
  const mergeDuplicate = useStore((s) => s.mergeDuplicate)
  const dismissDuplicate = useStore((s) => s.dismissDuplicate)
  const [mergeId, setMergeId] = useState<string | null>(null)

  const contactCounts = useMemo(() => {
    const m = new Map<string, number>()
    contacts.forEach((c) => m.set(c.accountId, (m.get(c.accountId) ?? 0) + 1))
    return m
  }, [contacts])

  if (duplicates.length === 0) {
    return (
      <EmptyState
        icon={CopyIcon}
        title="No duplicates detected"
        description="New records are matched by domain. Potential duplicates will show up here for review."
      />
    )
  }

  const mergeDup = mergeId ? lookup.account(mergeId) : undefined
  const mergeTarget = mergeDup ? lookup.account(mergeDup.duplicateOf) : undefined

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {duplicates.length} potential duplicate{duplicates.length === 1 ? "" : "s"} found by domain match. Merging moves contacts,
        signals and deals onto the canonical record.
      </p>
      {duplicates.map((dup) => {
        const target = lookup.account(dup.duplicateOf)
        return (
          <Card key={dup.id} className="gap-0 py-0">
            <CardContent className="p-0">
              <div className="grid items-stretch md:grid-cols-[1fr_auto_1fr]">
                <RecordSummary account={dup} label="Duplicate" contacts={contactCounts.get(dup.id) ?? 0} tone="warning" />
                <div className="flex items-center justify-center p-2 text-muted-foreground">
                  <ArrowRightIcon className="size-4 rotate-90 md:rotate-0" />
                </div>
                {target ? (
                  <RecordSummary account={target} label="Canonical" contacts={contactCounts.get(target.id) ?? 0} tone="success" />
                ) : (
                  <div className="flex items-center p-4 text-sm text-muted-foreground">Canonical record no longer exists.</div>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/30 px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    dismissDuplicate(dup.id)
                    toast.success(`“${dup.name}” marked as not a duplicate`)
                  }}
                >
                  <XIcon /> Not a duplicate
                </Button>
                <Button size="sm" disabled={!target} onClick={() => setMergeId(dup.id)}>
                  <MergeIcon /> Merge into canonical
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
      <ConfirmDialog
        open={!!mergeId}
        onOpenChange={(o) => !o && setMergeId(null)}
        title={`Merge “${mergeDup?.name ?? ""}” into “${mergeTarget?.name ?? ""}”?`}
        description="Contacts, signals and deals move to the canonical record and the duplicate is removed."
        confirmLabel="Merge"
        destructive={false}
        onConfirm={() => {
          if (!mergeId) return
          mergeDuplicate(mergeId)
          toast.success(`Merged into ${mergeTarget?.name}`)
          setMergeId(null)
        }}
      />
    </div>
  )
}

function RecordSummary({
  account,
  label,
  contacts,
  tone,
}: {
  account: Account
  label: string
  contacts: number
  tone: "warning" | "success"
}) {
  const rows: [string, React.ReactNode][] = [
    ["Domain", account.domain],
    ["Created", shortDate(account.createdAt)],
    ["Source", account.versions[0]?.source ?? "—"],
    ["Industry", account.industry],
    ["Contacts", contacts],
  ]
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <CompanyAvatar name={account.name} />
        <div className="min-w-0 flex-1">
          <Link href={`/accounts/${account.id}`} className="block truncate font-medium hover:underline">
            {account.name}
          </Link>
          <div className="truncate text-xs text-muted-foreground">
            Score {account.score} · Tier {account.tier}
          </div>
        </div>
        <StatusBadge status={tone} tone={tone} label={label} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
