"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CircleCheckIcon, PauseIcon, PlayIcon, Trash2Icon, UsersIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BulkBar, TablePagination } from "@/components/accounts/table-kit"
import { PersonAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status"
import { dateTime, fullName, timeAgo } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Enrollment, Sequence } from "@/lib/types"

type StatusFilter = "all" | Enrollment["status"]
const STATUSES: Enrollment["status"][] = ["active", "paused", "completed", "replied", "bounced", "unsubscribed"]
const PAGE_SIZE = 25

export function SequenceEnrolled({ sequence, enrollAction }: { sequence: Sequence; enrollAction: React.ReactNode }) {
  const allEnrollments = useStore((s) => s.enrollments)
  const setEnrollmentStatus = useStore((s) => s.setEnrollmentStatus)
  const removeEnrollments = useStore((s) => s.removeEnrollments)
  const lookup = useLookup()

  const [status, setStatus] = useState<StatusFilter>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const enrollments = useMemo(
    () => allEnrollments.filter((e) => e.sequenceId === sequence.id).sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt)),
    [allEnrollments, sequence.id],
  )
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: enrollments.length }
    for (const e of enrollments) c[e.status] = (c[e.status] ?? 0) + 1
    return c
  }, [enrollments])

  const filtered = useMemo(
    () => (status === "all" ? enrollments : enrollments.filter((e) => e.status === status)),
    [enrollments, status],
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // Only keep selections that are still visible under the current filter.
  const selectedIds = filtered.filter((e) => selected.has(e.id)).map((e) => e.id)
  const allRowsSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someRowsSelected = rows.some((r) => selected.has(r.id))

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const toggleRows = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const r of rows) {
        if (on) next.add(r.id)
        else next.delete(r.id)
      }
      return next
    })

  const bulkStatus = (s: "active" | "paused" | "completed") => {
    setEnrollmentStatus(selectedIds, s)
    const verb = s === "active" ? "resumed" : s === "paused" ? "paused" : "marked completed"
    toast.success(`${selectedIds.length} enrollment${selectedIds.length === 1 ? "" : "s"} ${verb}`)
    setSelected(new Set())
  }

  if (enrollments.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No one enrolled yet"
        description="Enroll contacts to start this sequence."
        action={enrollAction}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as StatusFilter)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses ({counts.all})</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)} ({counts[s] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BulkBar count={selectedIds.length} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="outline" onClick={() => bulkStatus("paused")}>
          <PauseIcon /> Pause
        </Button>
        <Button size="sm" variant="outline" onClick={() => bulkStatus("active")}>
          <PlayIcon /> Resume
        </Button>
        <Button size="sm" variant="outline" onClick={() => bulkStatus("completed")}>
          <CircleCheckIcon /> Mark completed
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setConfirmRemove(true)}>
          <Trash2Icon /> Remove
        </Button>
      </BulkBar>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <Checkbox
                  aria-label="Select page"
                  checked={allRowsSelected ? true : someRowsSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleRows(!!v)}
                />
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead className="pr-4">Next step</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No enrollments with this status.
                </TableCell>
              </TableRow>
            )}
            {rows.map((e) => {
              const c = lookup.contact(e.contactId)
              const a = lookup.account(c?.accountId)
              const total = sequence.steps.length
              const stepNo = Math.min(e.currentStep + 1, Math.max(total, 1))
              return (
                <TableRow key={e.id} data-state={selected.has(e.id) ? "selected" : undefined}>
                  <TableCell className="pl-4">
                    <Checkbox
                      aria-label="Select enrollment"
                      checked={selected.has(e.id)}
                      onCheckedChange={(v) => toggle(e.id, !!v)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PersonAvatar name={c ? fullName(c) : "?"} />
                      <div className="min-w-0">
                        {c ? (
                          <Link href={`/contacts?id=${c.id}`} className="block truncate font-medium hover:underline">
                            {fullName(c)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Deleted contact</span>
                        )}
                        <div className="max-w-48 truncate text-xs text-muted-foreground">{c?.title}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {a ? (
                      <Link href={`/accounts/${a.id}`} className="hover:underline">
                        {a.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm tabular-nums">
                        Step {stepNo} of {total}
                      </div>
                      <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${total ? (e.status === "completed" ? 100 : (stepNo / total) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(e.enrolledAt)}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground">
                    {e.status === "active" && e.nextStepAt ? dateTime(e.nextStepAt) : "—"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <TablePagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </Card>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${selectedIds.length} enrollment${selectedIds.length === 1 ? "" : "s"}?`}
        description="These contacts will stop receiving steps from this sequence."
        confirmLabel="Remove"
        onConfirm={() => {
          removeEnrollments(selectedIds)
          toast.success(`${selectedIds.length} enrollment${selectedIds.length === 1 ? "" : "s"} removed`)
          setSelected(new Set())
        }}
      />
    </div>
  )
}
