"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarCheckIcon,
  CopyIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  ReplyIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OwnerLabel } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryError, TableSkeleton } from "@/components/shared/query-state"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status"
import {
  canWrite,
  type SequenceRecord,
  useCurrentUser,
  useDeleteSequence,
  useDuplicateSequence,
  useOutreachStats,
  useSequences,
  useUpdateSequence,
  useUsers,
} from "@/lib/api"
import { number, percent } from "@/lib/format"
import type { Sequence, StepChannel } from "@/lib/types"
import { StepChannelIcon, rate } from "./channel"
import { NewSequenceDialog } from "./new-sequence-dialog"
import { useDebounced } from "./use-debounced"

type StatusFilter = "all" | Sequence["status"]

export function SequencesTab() {
  const router = useRouter()
  const me = useCurrentUser()
  const writable = canWrite(me.role)
  const { data: users } = useUsers()
  const updateSequence = useUpdateSequence()
  const duplicateSequence = useDuplicateSequence()
  const deleteSequence = useDeleteSequence()

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [toDelete, setToDelete] = useState<SequenceRecord | null>(null)
  const q = useDebounced(query.trim())

  const statsQuery = useOutreachStats()
  const totals = statsQuery.data
  const list = useSequences({ q: q || undefined, status: status === "all" ? undefined : [status] })
  const sequences = list.data?.data ?? []
  const filtering = !!q || status !== "all"

  const ownerOf = (s: SequenceRecord) =>
    users?.find((u) => u.id === s.ownerId) ?? (s.ownerName ? { name: s.ownerName, avatarColor: "bg-muted-foreground" } : null)

  const toggleStatus = (s: SequenceRecord) => {
    const next = s.status === "active" ? "paused" : "active"
    updateSequence.mutate(
      { id: s.id, status: next },
      {
        onSuccess: () =>
          toast.success(next === "active" ? "Sequence activated" : "Sequence paused", { description: s.name }),
      },
    )
  }

  const duplicate = (s: SequenceRecord) => {
    duplicateSequence.mutate(s.id, {
      onSuccess: (copy) =>
        toast.success("Sequence duplicated", {
          description: copy.name,
          action: { label: "Open", onClick: () => router.push(`/outreach/${copy.id}`) },
        }),
    })
  }

  return (
    <div className="space-y-4">
      {statsQuery.isError ? (
        <QueryError error={statsQuery.error} onRetry={() => statsQuery.refetch()} title="Couldn't load outreach stats" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {!totals ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[6.5rem] rounded-xl" />)
          ) : (
            <>
              <StatCard
                label="Enrolled"
                value={number(totals.enrolled)}
                icon={UsersIcon}
                hint={`${totals.activeEnrollments} currently active`}
              />
              <StatCard label="Emails sent" value={number(totals.sent)} icon={SendIcon} hint={`${totals.totalSequences} sequences`} />
              <StatCard label="Open rate" value={percent(totals.openRate)} icon={EyeIcon} hint={`${number(totals.opened)} opens`} />
              <StatCard label="Reply rate" value={percent(totals.replyRate)} icon={ReplyIcon} hint={`${number(totals.replied)} replies`} />
              <StatCard
                label="Meetings booked"
                value={number(totals.meetings)}
                icon={CalendarCheckIcon}
                hint={`${percent(rate(totals.meetings, totals.replied))} of replies`}
              />
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search sequences…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        {writable && (
          <div className="sm:ml-auto">
            <NewSequenceDialog />
          </div>
        )}
      </div>

      {list.isError ? (
        <QueryError error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <Card className="py-0">
          <TableSkeleton rows={5} />
        </Card>
      ) : sequences.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title={filtering ? "No sequences match" : "No sequences yet"}
          description={filtering ? "Try a different search or status filter." : "Create your first multi-channel sequence."}
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Sequence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead className="text-right">Open rate</TableHead>
                <TableHead className="text-right">Reply rate</TableHead>
                <TableHead className="text-right">Meetings</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequences.map((s) => {
                const channels = [...new Set(s.steps.map((st) => st.channel))] as StepChannel[]
                return (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-72 pl-4">
                      <Link href={`/outreach/${s.id}`} className="block truncate font-medium hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm tabular-nums">{s.steps.length}</span>
                        <div className="flex -space-x-1">
                          {channels.map((c) => (
                            <StepChannelIcon key={c} channel={c} className="size-6 ring-2 ring-background [&_svg]:size-3" />
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <OwnerLabel user={ownerOf(s)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div>{number(s.stats.enrolled)}</div>
                      <div className="text-xs text-muted-foreground">{s.activeEnrollments} active</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{percent(rate(s.stats.opened, s.stats.sent))}</TableCell>
                    <TableCell className="text-right tabular-nums">{percent(rate(s.stats.replied, s.stats.sent))}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.stats.meetings}</TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Sequence actions">
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild>
                            <Link href={`/outreach/${s.id}`}>
                              <EyeIcon /> Open
                            </Link>
                          </DropdownMenuItem>
                          {writable && (
                            <>
                              <DropdownMenuItem onSelect={() => toggleStatus(s)}>
                                {s.status === "active" ? <PauseIcon /> : <PlayIcon />}
                                {s.status === "active" ? "Pause" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => duplicate(s)}>
                                <CopyIcon /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(s)}>
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
        </Card>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.name ?? ""}”?`}
        description="This removes the sequence and all of its enrollments. This cannot be undone."
        confirmLabel="Delete sequence"
        onConfirm={() => {
          if (!toDelete) return
          deleteSequence.mutate(toDelete.id)
          setToDelete(null)
        }}
      />
    </div>
  )
}
