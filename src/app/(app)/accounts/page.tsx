"use client"

import { Suspense, useState } from "react"
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
  UploadIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { AddAccountDialog, sellersOf } from "@/components/accounts/account-dialogs"
import { ImportDialog } from "@/components/accounts/import-dialog"
import { BulkBar, nextSort, SortButton, type SortDir, TablePagination } from "@/components/accounts/table-kit"
import { useDebounced } from "@/components/accounts/use-debounced"
import { EnrollDialog } from "@/components/contacts/enroll-dialog"
import { CompanyAvatar, OwnerLabel, UserAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { QueryError, TableSkeleton } from "@/components/shared/query-state"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  type AccountFilters,
  canWrite,
  type DuplicatePair,
  useAccountCounts,
  useAccounts,
  useAssignOwner,
  useBulkDeleteAccounts,
  useCurrentUser,
  useDismissDuplicate,
  useDuplicates,
  useEnrichAccounts,
  useMergeDuplicate,
  useMeta,
  useRescoreAccounts,
  useUsers,
} from "@/lib/api"
import { INDUSTRIES, STAGE_LABELS } from "@/lib/constants"
import { shortDate, timeAgo } from "@/lib/format"
import type { AccountStage, Tier } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20
const ALL = "all"
const UNASSIGNED = "__none__"

type View = "all" | "mine" | "unassigned" | "duplicates"
type SortKey = "name" | "score" | "intent" | "employees" | "updated"

/** UI sort column → API sort field. */
const SORT_FIELDS: Record<SortKey, string> = {
  name: "name",
  score: "score",
  intent: "intentScore",
  employees: "employees",
  updated: "updatedAt",
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
  const writable = canWrite(me.role)
  const { data: users } = useUsers()
  const { data: meta } = useMeta()
  const { data: counts } = useAccountCounts()
  const enrichAccounts = useEnrichAccounts()
  const rescoreAccounts = useRescoreAccounts()
  const assignOwner = useAssignOwner()
  const bulkDelete = useBulkDeleteAccounts()

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
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [addOpenManual, setAddOpenManual] = useState(false)
  const [importOpenManual, setImportOpenManual] = useState(false)

  // `?new=1` opens the add dialog, `?import=1` the import dialog (e.g. from the command menu)
  const wantsNew = writable && searchParams.get("new") === "1"
  const addOpen = addOpenManual || wantsNew
  const setAddOpen = (open: boolean) => {
    setAddOpenManual(open)
    if (!open && wantsNew) router.replace("/accounts")
  }
  const wantsImport = writable && searchParams.get("import") === "1"
  const importOpen = importOpenManual || wantsImport
  const setImportOpen = (open: boolean) => {
    setImportOpenManual(open)
    if (!open && wantsImport) router.replace("/accounts")
  }

  const sellers = sellersOf(users)
  const userById = (id: string | null | undefined) => (id ? users?.find((u) => u.id === id) : undefined)
  const industries = meta?.industries?.length ? meta.industries : INDUSTRIES

  const q = useDebounced(search.trim())
  const filters: AccountFilters = {
    view: view === "duplicates" ? "all" : view,
    q: q || undefined,
    tier: tier !== ALL ? [tier as Tier] : undefined,
    industry: industry !== ALL ? [industry] : undefined,
    stage: stage !== ALL ? [stage as AccountStage] : undefined,
    ownerId: owner === ALL ? undefined : owner === UNASSIGNED ? "none" : owner,
    sort: `${SORT_FIELDS[sort.key]}:${sort.dir}`,
    page: page + 1,
    pageSize: PAGE_SIZE,
  }
  const listQuery = useAccounts(filters, view !== "duplicates")
  const pageRows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id))
  const someOnPage = pageRows.some((r) => selected.includes(r.id))
  const togglePage = (on: boolean) => {
    const ids = pageRows.map((r) => r.id)
    setSelected((prev) => (on ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id))))
  }
  const toggleRow = (id: string, on: boolean) => setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v)
      setPage(0)
    }

  const hasFilters = search || tier !== ALL || industry !== ALL || stage !== ALL || owner !== ALL
  const clearFilters = () => {
    setSearch("")
    setTier(ALL)
    setIndustry(ALL)
    setStage(ALL)
    setOwner(ALL)
    setPage(0)
  }

  const nameOf = (id: string) => pageRows.find((r) => r.id === id)?.name
  const labelFor = (ids: string[]) => (ids.length === 1 ? (nameOf(ids[0]) ?? "account") : `${ids.length} accounts`)

  // ------------------------------------------------ actions
  const runEnrich = async (ids: string[]) => {
    if (ids.length === 0) return
    const label = labelFor(ids)
    setEnriching((prev) => [...prev, ...ids])
    const toastId = toast.loading(`Enriching ${label}…`)
    try {
      const r = await enrichAccounts.mutateAsync(ids)
      const rescored = r.results.filter((x) => x.rescore && x.rescore.before !== x.rescore.after).length
      toast.success(`Enriched ${label}`, {
        id: toastId,
        description: rescored ? `${rescored} score${rescored === 1 ? "" : "s"} changed` : undefined,
      })
    } catch {
      toast.dismiss(toastId) // error toast is shown by the mutation
    } finally {
      setEnriching((prev) => prev.filter((id) => !ids.includes(id)))
    }
  }

  const runRescore = async (ids: string[]) => {
    if (ids.length === 0) return
    const label = labelFor(ids)
    try {
      const { results } = await rescoreAccounts.mutateAsync(ids)
      if (results.length === 1) {
        const { before, after } = results[0]
        toast.success(`Re-scored ${label}`, { description: `Score ${before} → ${after}` })
        return
      }
      const changed = results.filter((r) => r.before !== r.after).length
      toast.success(`Re-scored ${results.length} accounts`, { description: `${changed} score${changed === 1 ? "" : "s"} changed` })
    } catch {
      // handled by the mutation
    }
  }

  const runAssign = (ids: string[], ownerId: string | null) => {
    const label = labelFor(ids)
    const name = ownerId ? (userById(ownerId)?.name ?? "owner") : "Unassigned"
    assignOwner.mutate(
      { ids, ownerId },
      { onSuccess: () => toast.success(ids.length === 1 ? `${label} → ${name}` : `Assigned ${ids.length} accounts to ${name}`) },
    )
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const { ids } = deleteTarget
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        setSelected((prev) => prev.filter((id) => !ids.includes(id)))
        if (ids.length >= pageRows.length && page > 0) setPage((p) => p - 1)
      },
    })
    setDeleteTarget(null)
  }

  const bulkBusy = selected.some((id) => enriching.includes(id))
  const showSelection = writable

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Every company in your TAM, enriched, de-duplicated and scored against your ICP."
        actions={
          writable && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <UploadIcon /> Import
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon /> Add account
              </Button>
            </>
          )
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
            All <CountBadge n={counts?.all} />
          </TabsTrigger>
          <TabsTrigger value="mine">
            My accounts <CountBadge n={counts?.mine} />
          </TabsTrigger>
          <TabsTrigger value="unassigned">
            Unassigned <CountBadge n={counts?.unassigned} />
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            Duplicates <CountBadge n={counts?.duplicates} highlight={!!counts?.duplicates} />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "duplicates" ? (
        <DuplicatesView writable={writable} />
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
            {listQuery.isFetching && !listQuery.isLoading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
          </div>

          {showSelection && (
            <BulkBar count={selected.length} onClear={() => setSelected([])}>
              <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => runEnrich(selected)}>
                {bulkBusy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} Enrich
              </Button>
              <Button variant="outline" size="sm" disabled={rescoreAccounts.isPending} onClick={() => runRescore(selected)}>
                {rescoreAccounts.isPending ? <Loader2Icon className="animate-spin" /> : <GaugeIcon />} Re-score
              </Button>
              <Select value="" onValueChange={(v) => runAssign(selected, v === UNASSIGNED ? null : v)}>
                <SelectTrigger size="sm" className="w-[150px]" disabled={assignOwner.isPending}>
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
              <Button variant="outline" size="sm" onClick={() => setEnrollOpen(true)}>
                <ListPlusIcon /> Add contacts to sequence
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteTarget({ ids: selected, label: labelFor(selected) })}>
                <Trash2Icon /> Delete
              </Button>
            </BulkBar>
          )}

          {listQuery.error && !listQuery.data ? (
            <QueryError error={listQuery.error} onRetry={() => listQuery.refetch()} title="Couldn't load accounts" />
          ) : (
            <Card className="gap-0 overflow-hidden py-0">
              {listQuery.isLoading ? (
                <TableSkeleton rows={10} />
              ) : (
                <Table className={cn(listQuery.isPlaceholderData && "opacity-60 transition-opacity")}>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      {showSelection && (
                        <TableHead className="w-10 pl-4">
                          <Checkbox
                            aria-label="Select page"
                            checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                            onCheckedChange={(v) => togglePage(v === true)}
                          />
                        </TableHead>
                      )}
                      <TableHead className={cn("min-w-[220px]", !showSelection && "pl-4")}>
                        <SortButton label="Company" column="name" sort={sort} onSort={(k) => resetPage(setSort)(nextSort(sort, k, "asc"))} />
                      </TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>
                        <SortButton label="Employees" column="employees" sort={sort} onSort={(k) => resetPage(setSort)(nextSort(sort, k))} />
                      </TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>
                        <SortButton label="Score" column="score" sort={sort} onSort={(k) => resetPage(setSort)(nextSort(sort, k))} />
                      </TableHead>
                      <TableHead>
                        <SortButton label="Intent" column="intent" sort={sort} onSort={(k) => resetPage(setSort)(nextSort(sort, k))} />
                      </TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>
                        <SortButton label="Updated" column="updated" sort={sort} onSort={(k) => resetPage(setSort)(nextSort(sort, k))} />
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
                            title={hasFilters || view !== "all" ? "No accounts match" : "No accounts yet"}
                            description={
                              hasFilters ? "Try a different search or clear your filters." : "Add accounts manually or import them from a file."
                            }
                            action={
                              hasFilters ? (
                                <Button variant="outline" size="sm" onClick={clearFilters}>
                                  Clear filters
                                </Button>
                              ) : writable ? (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                                    <UploadIcon /> Import
                                  </Button>
                                  <Button size="sm" onClick={() => setAddOpen(true)}>
                                    <PlusIcon /> Add account
                                  </Button>
                                </div>
                              ) : undefined
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    {pageRows.map((a) => {
                      const isSel = selected.includes(a.id)
                      const isEnriching = enriching.includes(a.id)
                      return (
                        <TableRow key={a.id} data-state={isSel ? "selected" : undefined}>
                          {showSelection && (
                            <TableCell className="pl-4">
                              <Checkbox aria-label={`Select ${a.name}`} checked={isSel} onCheckedChange={(v) => toggleRow(a.id, v === true)} />
                            </TableCell>
                          )}
                          <TableCell className={cn(!showSelection && "pl-4")}>
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
                            <OwnerLabel user={userById(a.ownerId)} />
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
                                {writable && (
                                  <>
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
                                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget({ ids: [a.id], label: a.name })}>
                                      <Trash2Icon /> Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </Card>
          )}
        </div>
      )}

      {writable && (
        <>
          <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} />
          <ImportDialog type="accounts" open={importOpen} onOpenChange={setImportOpen} />
          <EnrollDialog
            open={enrollOpen}
            onOpenChange={setEnrollOpen}
            target={{ kind: "accounts", accountIds: selected }}
            onDone={() => setSelected([])}
          />
          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title={`Delete ${deleteTarget?.label ?? "account"}?`}
            description="This also removes their contacts, deals, signals and drafts. This cannot be undone."
            confirmLabel="Delete"
            onConfirm={confirmDelete}
          />
        </>
      )}
    </>
  )
}

function CountBadge({ n, highlight }: { n?: number; highlight?: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-4.5 min-w-5 px-1.5 text-[11px] tabular-nums",
        highlight && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      )}
    >
      {n ?? "–"}
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

function DuplicatesView({ writable }: { writable: boolean }) {
  const { data: pairs, isLoading, error, refetch } = useDuplicates()
  const mergeDuplicate = useMergeDuplicate()
  const dismissDuplicate = useDismissDuplicate()
  const [mergePair, setMergePair] = useState<DuplicatePair | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-96 max-w-full" />
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (error) return <QueryError error={error} onRetry={() => refetch()} title="Couldn't load duplicates" />

  const duplicates = pairs ?? []
  if (duplicates.length === 0) {
    return (
      <EmptyState
        icon={CopyIcon}
        title="No duplicates detected"
        description="New records are matched by domain. Potential duplicates will show up here for review."
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {duplicates.length} potential duplicate{duplicates.length === 1 ? "" : "s"} found by domain match. Merging moves contacts,
        signals and deals onto the canonical record.
      </p>
      {duplicates.map((pair) => {
        const { duplicate: dup, canonical: target } = pair
        const busy =
          (mergeDuplicate.isPending && mergeDuplicate.variables === dup.id) ||
          (dismissDuplicate.isPending && dismissDuplicate.variables === dup.id)
        return (
          <Card key={dup.id} className="gap-0 py-0">
            <CardContent className="p-0">
              <div className="grid items-stretch md:grid-cols-[1fr_auto_1fr]">
                <RecordSummary account={dup} label="Duplicate" tone="warning" />
                <div className="flex items-center justify-center p-2 text-muted-foreground">
                  <ArrowRightIcon className="size-4 rotate-90 md:rotate-0" />
                </div>
                {target ? (
                  <RecordSummary account={target} label="Canonical" tone="success" />
                ) : (
                  <div className="flex items-center p-4 text-sm text-muted-foreground">Canonical record no longer exists.</div>
                )}
              </div>
              {writable && (
                <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/30 px-4 py-3">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => dismissDuplicate.mutate(dup.id)}>
                    <XIcon /> Not a duplicate
                  </Button>
                  <Button size="sm" disabled={!target || busy} onClick={() => setMergePair(pair)}>
                    {busy ? <Loader2Icon className="animate-spin" /> : <MergeIcon />} Merge into canonical
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
      <ConfirmDialog
        open={!!mergePair}
        onOpenChange={(o) => !o && setMergePair(null)}
        title={`Merge “${mergePair?.duplicate.name ?? ""}” into “${mergePair?.canonical?.name ?? ""}”?`}
        description="Contacts, signals and deals move to the canonical record and the duplicate is removed."
        confirmLabel="Merge"
        destructive={false}
        onConfirm={() => {
          if (!mergePair) return
          mergeDuplicate.mutate(mergePair.duplicate.id)
          setMergePair(null)
        }}
      />
    </div>
  )
}

function RecordSummary({
  account,
  label,
  tone,
}: {
  account: DuplicatePair["duplicate"]
  label: string
  tone: "warning" | "success"
}) {
  const rows: [string, React.ReactNode][] = [
    ["Domain", account.domain],
    ["Created", shortDate(account.createdAt)],
    ["Source", account.source || "—"],
    ["Industry", account.industry],
    ["Contacts", account.contactCount],
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
