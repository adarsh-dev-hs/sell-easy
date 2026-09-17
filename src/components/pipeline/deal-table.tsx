"use client"

import { useMemo, useState } from "react"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, CheckCircle2Icon } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CompanyAvatar, OwnerLabel } from "@/components/shared/avatars"
import { StatusBadge } from "@/components/shared/status"
import { DEAL_STAGE_LABEL, DEAL_STAGES } from "@/lib/constants"
import { currency, shortDate, timeAgo } from "@/lib/format"
import { useLookup } from "@/lib/store"
import type { Deal } from "@/lib/types"
import { cn } from "@/lib/utils"
import { isOverdue } from "./deal-utils"

type SortKey = "name" | "account" | "stage" | "amount" | "probability" | "closeDate" | "owner" | "crm" | "updatedAt"

const STAGE_INDEX = Object.fromEntries(DEAL_STAGES.map((s, i) => [s.id, i]))

export function DealTable({ deals, nowMs, onOpen }: { deals: Deal[]; nowMs: number; onOpen: (id: string) => void }) {
  const lookup = useLookup()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "updatedAt", dir: -1 })

  const rows = useMemo(() => {
    const value = (d: Deal): string | number => {
      switch (sort.key) {
        case "name":
          return d.name.toLowerCase()
        case "account":
          return (lookup.account(d.accountId)?.name ?? "").toLowerCase()
        case "stage":
          return STAGE_INDEX[d.stage]
        case "amount":
          return d.amount
        case "probability":
          return d.probability
        case "closeDate":
          return d.closeDate
        case "owner":
          return (lookup.user(d.ownerId)?.name ?? "").toLowerCase()
        case "crm":
          return d.syncedAt ? 1 : 0
        case "updatedAt":
          return d.updatedAt
      }
    }
    return [...deals].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir
    })
  }, [deals, sort, lookup])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "amount" || key === "updatedAt" ? -1 : 1 }))

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
            <SortHead sort={sort} onToggle={toggle} k="owner">Owner</SortHead>
            <SortHead sort={sort} onToggle={toggle} k="crm">CRM</SortHead>
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
          {rows.map((d) => {
            const account = lookup.account(d.accountId)
            return (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => onOpen(d.id)}>
                <TableCell className="max-w-64 truncate font-medium">{d.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <CompanyAvatar name={account?.name ?? "?"} className="size-6 text-[10px]" />
                    <span className="max-w-40 truncate">{account?.name ?? "—"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={d.stage}
                    label={DEAL_STAGE_LABEL[d.stage]}
                    tone={d.stage.startsWith("closed") ? undefined : "info"}
                  />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{currency(d.amount, false)}</TableCell>
                <TableCell className="text-right tabular-nums">{d.probability}%</TableCell>
                <TableCell className={cn(isOverdue(d, nowMs) && "font-medium text-rose-600 dark:text-rose-400")}>
                  {shortDate(d.closeDate)}
                </TableCell>
                <TableCell>
                  <OwnerLabel user={lookup.user(d.ownerId)} />
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
            )
          })}
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
  k: SortKey
  children: React.ReactNode
  className?: string
  sort: { key: SortKey; dir: 1 | -1 }
  onToggle: (k: SortKey) => void
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
