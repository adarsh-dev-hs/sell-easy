"use client"

import { Suspense, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { startOfQuarter } from "date-fns"
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
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { DealBoard } from "@/components/pipeline/deal-board"
import { DealSheet } from "@/components/pipeline/deal-sheet"
import { DealTable } from "@/components/pipeline/deal-table"
import { currentTime, isClosed } from "@/components/pipeline/deal-utils"
import { NewDealDialog } from "@/components/pipeline/new-deal-dialog"
import { currency, percent } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"

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
  const newOpen = params.get("new") === "1"

  const deals = useStore((s) => s.deals)
  const users = useStore((s) => s.users)
  const currentUserId = useStore((s) => s.currentUserId)
  const syncCrm = useStore((s) => s.syncCrm)
  const lookup = useLookup()

  const [nowMs] = useState(currentTime)
  const [query, setQuery] = useState("")
  const [owner, setOwner] = useState("all")
  const [hideClosed, setHideClosed] = useState(false)
  const [view, setView] = useState<"board" | "table">("board")
  const [syncing, setSyncing] = useState(false)

  const setParam = (key: "deal" | "new", value: string | null) => {
    const next = new URLSearchParams(params.toString())
    next.delete("deal")
    next.delete("new")
    if (value) next.set(key, value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const openDeal = (id: string) => setParam("deal", id)

  const sellers = useMemo(() => users.filter((u) => u.role !== "viewer"), [users])

  // Search + owner filters (stats use these, so closed deals stay in for won / win rate)
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase()
    return deals.filter((d) => {
      if (owner !== "all" && d.ownerId !== owner) return false
      if (!q) return true
      const account = lookup.account(d.accountId)
      return (
        d.name.toLowerCase().includes(q) ||
        (account?.name.toLowerCase().includes(q) ?? false) ||
        (account?.domain.toLowerCase().includes(q) ?? false) ||
        (d.crmId?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [deals, owner, query, lookup])

  const visible = useMemo(() => (hideClosed ? scoped.filter((d) => !isClosed(d.stage)) : scoped), [scoped, hideClosed])

  const stats = useMemo(() => {
    const open = scoped.filter((d) => !isClosed(d.stage))
    const won = scoped.filter((d) => d.stage === "closed_won")
    const lost = scoped.filter((d) => d.stage === "closed_lost")
    const qStart = startOfQuarter(nowMs).getTime()
    const wonQ = won.filter((d) => new Date(d.closeDate).getTime() >= qStart)
    return {
      open: open.reduce((s, d) => s + d.amount, 0),
      openCount: open.length,
      weighted: open.reduce((s, d) => s + (d.amount * d.probability) / 100, 0),
      wonQuarter: wonQ.reduce((s, d) => s + d.amount, 0),
      wonQuarterCount: wonQ.length,
      winRate: won.length + lost.length ? (won.length / (won.length + lost.length)) * 100 : 0,
      closedCount: won.length + lost.length,
      avgDeal: won.length ? won.reduce((s, d) => s + d.amount, 0) / won.length : 0,
      wonCount: won.length,
      unsynced: scoped.filter((d) => !d.syncedAt).length,
    }
  }, [scoped, nowMs])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const n = await syncCrm()
      toast.success(`${n} deal${n === 1 ? "" : "s"} pushed to HubSpot`, {
        description: n ? "CRM records created and updated" : "Everything was already in sync",
      })
    } catch {
      toast.error("CRM sync failed")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Track every opportunity from discovery to close, synced with your CRM."
        actions={
          <>
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2Icon className="animate-spin" /> : <CloudUploadIcon />}
              {syncing ? "Syncing…" : "Sync to CRM"}
            </Button>
            <Button onClick={() => setParam("new", "1")}>
              <PlusIcon /> New deal
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Open pipeline" value={currency(stats.open)} icon={DollarSignIcon} hint={`${stats.openCount} open deals`} />
        <StatCard label="Weighted pipeline" value={currency(stats.weighted)} icon={ScaleIcon} hint="Amount × probability" />
        <StatCard label="Won this quarter" value={currency(stats.wonQuarter)} icon={TrophyIcon} hint={`${stats.wonQuarterCount} deals closed`} />
        <StatCard label="Win rate" value={percent(stats.winRate, 0)} icon={PercentIcon} hint={`${stats.closedCount} closed deals`} />
        <StatCard label="Avg deal size" value={currency(stats.avgDeal)} icon={KanbanSquareIcon} hint={`Across ${stats.wonCount} won deals`} />
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
              <SelectItem value={currentUserId}>My deals</SelectItem>
              <SelectSeparator />
              {sellers
                .filter((u) => u.id !== currentUserId)
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
          {stats.unsynced > 0 && (
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

      {deals.length === 0 ? (
        <EmptyState
          icon={KanbanSquareIcon}
          title="No deals yet"
          description="Create your first deal or let the agent open deals from high-intent signals."
          action={
            <Button onClick={() => setParam("new", "1")}>
              <PlusIcon /> New deal
            </Button>
          }
        />
      ) : view === "board" ? (
        <DealBoard deals={visible} nowMs={nowMs} onOpen={openDeal} />
      ) : (
        <DealTable deals={visible} nowMs={nowMs} onOpen={openDeal} />
      )}

      <DealSheet dealId={dealParam} onClose={() => setParam("deal", null)} />
      <NewDealDialog open={newOpen} onOpenChange={(o) => setParam("new", o ? "1" : null)} onCreated={openDeal} />
    </>
  )
}
