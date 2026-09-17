"use client"

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SortDir = "asc" | "desc"

export function SortButton<K extends string>({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string
  column: K
  sort: { key: K; dir: SortDir }
  onSort: (key: K) => void
  className?: string
}) {
  const active = sort.key === column
  const Icon = !active ? ArrowUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2 h-7 px-2 font-medium", active ? "text-foreground" : "text-muted-foreground", className)}
      onClick={() => onSort(column)}
    >
      {label}
      <Icon className={cn(!active && "opacity-50")} />
    </Button>
  )
}

/** Returns a toggling sort updater: same column flips direction, new column starts with `defaultDir`. */
export function nextSort<K extends string>(prev: { key: K; dir: SortDir }, key: K, defaultDir: SortDir = "desc") {
  return prev.key === key ? { key, dir: (prev.dir === "asc" ? "desc" : "asc") as SortDir } : { key, dir: defaultDir }
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  return (
    <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">
          Page {Math.min(page + 1, pages)} of {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeftIcon /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}

export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
      <span className="text-sm font-medium">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
