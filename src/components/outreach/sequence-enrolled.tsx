"use client"

import { useState } from "react"
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
import { QueryError, TableSkeleton } from "@/components/shared/query-state"
import { StatusBadge } from "@/components/shared/status"
import { dateTime, fullName, timeAgo } from "@/lib/format"
import { type SequenceRecord, useBulkEnrollmentStatus, useRemoveEnrollments, useSequenceEnrollments } from "@/lib/api"
import type { Enrollment } from "@/lib/types"

type StatusFilter = "all" | Enrollment["status"]
const STATUSES: Enrollment["status"][] = ["active", "paused", "completed", "replied", "bounced", "unsubscribed"]
const PAGE_SIZE = 25

const ENROLLMENT_TOTAL = { pageSize: 1 } as const
const plural = (n: number) => `${n} enrollment${n === 1 ? "" : "s"}`

export function SequenceEnrolled({
  sequence,
  enrollAction,
  readOnly = false,
}: {
  sequence: SequenceRecord
  enrollAction: React.ReactNode
  readOnly?: boolean
}) {
  const bulkStatusMutation = useBulkEnrollmentStatus()
  const removeEnrollments = useRemoveEnrollments()

  const [status, setStatus] = useState<StatusFilter>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const totalQuery = useSequenceEnrollments(sequence.id, ENROLLMENT_TOTAL)
  const list = useSequenceEnrollments(sequence.id, {
    page: page + 1,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : [status],
  })
  const rows = list.data?.data ?? []
  const filteredTotal = list.data?.meta.total ?? 0
  const allTotal = totalQuery.data?.meta.total

  const selectedIds = [...selected]
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
    const verb = s === "active" ? "resumed" : s === "paused" ? "paused" : "marked completed"
    bulkStatusMutation.mutate(
      { ids: selectedIds, status: s },
      {
        onSuccess: (r) => {
          toast.success(`${plural(r.updated)} ${verb}`)
          setSelected(new Set())
        },
      },
    )
  }

  if (list.isError) return <QueryError error={list.error} onRetry={() => list.refetch()} />

  if (list.isPending || totalQuery.isPending) {
    return (
      <Card className="py-0">
        <TableSkeleton rows={6} />
      </Card>
    )
  }

  if (allTotal === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No one enrolled yet"
        description={readOnly ? "No contacts are enrolled in this sequence." : "Enroll contacts to start this sequence."}
        action={enrollAction}
      />
    )
  }

  const busy = bulkStatusMutation.isPending || removeEnrollments.isPending
  const colSpan = readOnly ? 6 : 7

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as StatusFilter)
            setPage(0)
            setSelected(new Set())
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses{allTotal !== undefined ? ` (${allTotal})` : ""}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
                {status === s ? ` (${filteredTotal})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!readOnly && (
        <BulkBar count={selectedIds.length} onClear={() => setSelected(new Set())}>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkStatus("paused")}>
            <PauseIcon /> Pause
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkStatus("active")}>
            <PlayIcon /> Resume
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkStatus("completed")}>
            <CircleCheckIcon /> Mark completed
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmRemove(true)}>
            <Trash2Icon /> Remove
          </Button>
        </BulkBar>
      )}

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              {!readOnly && (
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Select page"
                    checked={allRowsSelected ? true : someRowsSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleRows(!!v)}
                  />
                </TableHead>
              )}
              <TableHead className={readOnly ? "pl-4" : undefined}>Contact</TableHead>
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
                <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                  No enrollments with this status.
                </TableCell>
              </TableRow>
            )}
            {rows.map((e) => {
              const c = e.contact
              const a = e.account
              const total = sequence.steps.length
              const stepNo = Math.min(e.currentStep + 1, Math.max(total, 1))
              return (
                <TableRow key={e.id} data-state={selected.has(e.id) ? "selected" : undefined}>
                  {!readOnly && (
                    <TableCell className="pl-4">
                      <Checkbox
                        aria-label="Select enrollment"
                        checked={selected.has(e.id)}
                        onCheckedChange={(v) => toggle(e.id, !!v)}
                      />
                    </TableCell>
                  )}
                  <TableCell className={readOnly ? "pl-4" : undefined}>
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
        <TablePagination page={page} pageSize={PAGE_SIZE} total={filteredTotal} onPageChange={setPage} />
      </Card>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${plural(selectedIds.length)}?`}
        description="These contacts will stop receiving steps from this sequence."
        confirmLabel="Remove"
        onConfirm={() => {
          removeEnrollments.mutate(selectedIds, {
            onSuccess: (r) => {
              toast.success(`${plural(r.removed)} removed`)
              setSelected(new Set())
              setPage(0)
            },
          })
        }}
      />
    </div>
  )
}
