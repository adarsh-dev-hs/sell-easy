"use client"

import { Suspense, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  CloudUploadIcon,
  DollarSignIcon,
  KanbanSquareIcon,
  Loader2Icon,
  PercentIcon,
  PlusIcon,
  ScaleIcon,
  SearchIcon,
  TableIcon,
  TrophyIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { QueryError, TableSkeleton } from "@/components/shared/query-state"
import { StatCard } from "@/components/shared/stat-card"
import { DealBoard, DealBoardSkeleton } from "@/components/pipeline/deal-board"
import { DealSheet } from "@/components/pipeline/deal-sheet"
import { DEFAULT_DEAL_SORT, type DealSort, dealSortParam, DealTable } from "@/components/pipeline/deal-table"
import { currentTime } from "@/components/pipeline/deal-utils"
import { useDebounced, useTeam } from "@/components/pipeline/hooks"
import { NewDealDialog } from "@/components/pipeline/new-deal-dialog"
import { canWrite, useCurrentUser, useDeals, usePipelineStats, useSyncCrm } from "@/lib/api"
import { currency, percent } from "@/lib/format"

export default function PipelinePage() {
  return (
    <Suspense>
      <Pipeline />
    </Suspense>
  )
}

function Pipeline() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const dealParam = params.get("deal")
  const user = useCurrentUser()
  const writable = canWrite(user.role)
  const newOpen = writable && params.get("new") === "1"

  const { sellers } = useTeam()
  const syncCrm = useSyncCrm()

  const [nowMs] = useState(currentTime)
  const [query, setQuery] = useState("")
  const [owner, setOwner] = useState("all")
  const [hideClosed, setHideClosed] = useState(false)
  const [view, setView] = useState<"board" | "table">("board")
  const [tableSort, setTableSort] = useState<DealSort>(DEFAULT_DEAL_SORT)

  const q = useDebounced(query.trim(), 250)
  const ownerId = owner === "all" ? undefined : owner
  const filters = useMemo(() => ({ q: q || undefined, ownerId }), [q, ownerId])

  // Stats keep closed deals in scope (won / win rate), so only search + owner apply.
  const { data: stats } = usePipelineStats(filters)
  const dealsQuery = useDeals({
    ...filters,
    hideClosed: hideClosed || undefined,
    pageSize: 1000,
    sort: view === "board" ? "updatedAt:desc" : dealSortParam(tableSort),
  })
  const deals = dealsQuery.data?.data ?? []
  const unfiltered = !q && !ownerId && !hideClosed

  const setParam = (key: "deal" | "new", value: string | null) => {
    const next = new URLSearchParams(params.toString())
    next.delete("deal")
    next.delete("new")
    if (value) next.set(key, value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const openDeal = (id: string) => setParam("deal", id)

  const dealCount = stats?.byStage.reduce((n, s) => n + s.count, 0) ?? 0
  const stat = (v: string | undefined) => v ?? <Skeleton className="h-8 w-24" />

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Track every opportunity from discovery to close, synced with your CRM."
        actions={
          <>
            {writable && (
              <>
                <Button variant="outline" onClick={() => syncCrm.mutate()} disabled={syncCrm.isPending}>
                  {syncCrm.isPending ? <Loader2Icon className="animate-spin" /> : <CloudUploadIcon />}
                  {syncCrm.isPending ? "Syncing…" : "Sync to CRM"}
                </Button>
                <Button onClick={() => setParam("new", "1")}>
                  <PlusIcon /> New deal
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Open pipeline"
          value={stat(stats && currency(stats.openPipeline))}
          icon={DollarSignIcon}
          hint={stats && `${stats.openCount} open deals`}
        />
        <StatCard
          label="Weighted pipeline"
          value={stat(stats && currency(stats.weightedPipeline))}
          icon={ScaleIcon}
          hint="Amount × probability"
        />
        <StatCard
          label="Won this quarter"
          value={stat(stats && currency(stats.wonThisQuarter))}
          icon={TrophyIcon}
          hint={stats && `${stats.wonThisQuarterCount} deals closed`}
        />
        <StatCard
          label="Win rate"
          value={stat(stats && percent(stats.winRate, 0))}
          icon={PercentIcon}
          hint={stats && `${stats.closedCount} closed deals`}
        />
        <StatCard
          label="Avg deal size"
          value={stat(stats && currency(stats.avgDealSize))}
          icon={KanbanSquareIcon}
          hint={stats && `Across all ${dealCount} deals`}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals, accounts, CRM id…"
            className="pl-8"
            aria-label="Search deals"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="w-44" aria-label="Filter by owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              <SelectItem value={user.id}>My deals</SelectItem>
              <SelectSeparator />
              {sellers
                .filter((u) => u.id !== user.id)
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="hide-closed" checked={hideClosed} onCheckedChange={setHideClosed} />
            <Label htmlFor="hide-closed" className="text-sm font-normal">
              Hide closed
            </Label>
          </div>
          {!!stats?.unsynced && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-amber-500" />
              {stats.unsynced} unsynced
            </span>
          )}
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={view}
          onValueChange={(v) => v && setView(v as "board" | "table")}
          className="lg:ml-auto"
        >
          <ToggleGroupItem value="board" aria-label="Board view">
            <KanbanSquareIcon /> Board
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <TableIcon /> Table
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {dealsQuery.isError && !dealsQuery.data ? (
        <QueryError error={dealsQuery.error} onRetry={() => dealsQuery.refetch()} />
      ) : !dealsQuery.data ? (
        view === "board" ? (
          <DealBoardSkeleton />
        ) : (
          <TableSkeleton className="rounded-xl border bg-card" />
        )
      ) : unfiltered && dealsQuery.data.meta.total === 0 ? (
        <EmptyState
          icon={KanbanSquareIcon}
          title="No deals yet"
          description="Create your first deal or let the agent open deals from high-intent signals."
          action={
            writable && (
              <Button onClick={() => setParam("new", "1")}>
                <PlusIcon /> New deal
              </Button>
            )
          }
        />
      ) : view === "board" ? (
        <DealBoard deals={deals} nowMs={nowMs} onOpen={openDeal} canEdit={writable} />
      ) : (
        <DealTable deals={deals} nowMs={nowMs} sort={tableSort} onSortChange={setTableSort} onOpen={openDeal} />
      )}

      <DealSheet dealId={dealParam} onClose={() => setParam("deal", null)} />
      {writable && <NewDealDialog open={newOpen} onOpenChange={(o) => setParam("new", o ? "1" : null)} onCreated={openDeal} />}
    </>
  )
}
