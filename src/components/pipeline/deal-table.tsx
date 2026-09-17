"use client"

import { useMemo } from "react"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, CheckCircle2Icon } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CompanyAvatar, OwnerLabel } from "@/components/shared/avatars"
import { StatusBadge } from "@/components/shared/status"
import type { DealRecord } from "@/lib/api"
import { DEAL_STAGE_LABEL } from "@/lib/constants"
import { currency, shortDate, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { isOverdue } from "./deal-utils"
import { useTeam } from "./hooks"

/** Columns sortable by the API (`sort=field:dir`). */
type ServerSortKey = "name" | "stage" | "amount" | "probability" | "closeDate" | "updatedAt"
/** `account` is sorted client-side on the loaded rows (the API can't sort by account name). */
export type DealSortKey = ServerSortKey | "account"
export type DealSort = { key: DealSortKey; dir: 1 | -1 }

export const DEFAULT_DEAL_SORT: DealSort = { key: "updatedAt", dir: -1 }

/** Server `sort` param for a table sort (account-name sorting falls back to the default order). */
export const dealSortParam = (sort: DealSort) =>
  sort.key === "account" ? "updatedAt:desc" : `${sort.key}:${sort.dir === 1 ? "asc" : "desc"}`

export const nextDealSort = (s: DealSort, key: DealSortKey): DealSort =>
  s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "amount" || key === "updatedAt" ? -1 : 1 }

export function DealTable({
  deals,
  nowMs,
  sort,
  onSortChange,
  onOpen,
}: {
  deals: DealRecord[]
  nowMs: number
  sort: DealSort
  onSortChange: (sort: DealSort) => void
  onOpen: (id: string) => void
}) {
  const { byId } = useTeam()

  const rows = useMemo(() => {
    if (sort.key !== "account") return deals
    return [...deals].sort((a, b) => (a.account?.name ?? "").localeCompare(b.account?.name ?? "") * sort.dir)
  }, [deals, sort])

  const toggle = (key: DealSortKey) => onSortChange(nextDealSort(sort, key))

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead sort={sort} onToggle={toggle} k="name">Deal</SortHead>
            <SortHead sort={sort} onToggle={toggle} k="account">Account</SortHead>
            <SortHead sort={sort} onToggle={toggle} k="stage">Stage</SortHead>
            <SortHead sort={sort} onToggle={toggle} k="amount" className="text-right">Amount</SortHead>
            <SortHead sort={sort} onToggle={toggle} k="probability" className="text-right">Prob.</SortHead>
            <SortHead sort={sort} onToggle={toggle} k="closeDate">Close date</SortHead>
            <TableHead>Owner</TableHead>
            <TableHead>CRM</TableHead>
            <SortHead sort={sort} onToggle={toggle} k="updatedAt">Updated</SortHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No deals match your filters.
              </TableCell>
            </TableRow>
          )}
          {rows.map((d) => (
            <TableRow key={d.id} className="cursor-pointer" onClick={() => onOpen(d.id)}>
              <TableCell className="max-w-64 truncate font-medium">{d.name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <CompanyAvatar name={d.account?.name ?? "?"} className="size-6 text-[10px]" />
                  <span className="max-w-40 truncate">{d.account?.name ?? "—"}</span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={d.stage} label={DEAL_STAGE_LABEL[d.stage]} tone={d.stage.startsWith("closed") ? undefined : "info"} />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{currency(d.amount, false)}</TableCell>
              <TableCell className="text-right tabular-nums">{d.probability}%</TableCell>
              <TableCell className={cn(isOverdue(d, nowMs) && "font-medium text-rose-600 dark:text-rose-400")}>
                {shortDate(d.closeDate)}
              </TableCell>
              <TableCell>
                <OwnerLabel user={byId.get(d.ownerId)} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-xs">
                  {d.syncedAt ? (
                    <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-amber-500" />
                  )}
                  <span className={cn("font-mono", !d.crmId && "text-muted-foreground")}>{d.crmId ?? "Not created"}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{timeAgo(d.updatedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SortHead({
  k,
  children,
  className,
  sort,
  onToggle,
}: {
  k: DealSortKey
  children: React.ReactNode
  className?: string
  sort: DealSort
  onToggle: (k: DealSortKey) => void
}) {
  const right = className?.includes("text-right")
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onToggle(k)}
        className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground", right && "flex-row-reverse")}
      >
        {children}
        {sort.key === k ? (
          sort.dir === 1 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />
        ) : (
          <ArrowUpDownIcon className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}
