"use client"

import { useMemo, useState } from "react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OwnerLabel } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status"
import { number, percent } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Sequence, StepChannel } from "@/lib/types"
import { StepChannelIcon, rate } from "./channel"
import { NewSequenceDialog } from "./new-sequence-dialog"

type StatusFilter = "all" | Sequence["status"]

export function SequencesTab() {
  const router = useRouter()
  const sequences = useStore((s) => s.sequences)
  const enrollments = useStore((s) => s.enrollments)
  const updateSequence = useStore((s) => s.updateSequence)
  const duplicateSequence = useStore((s) => s.duplicateSequence)
  const deleteSequence = useStore((s) => s.deleteSequence)
  const lookup = useLookup()

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [toDelete, setToDelete] = useState<Sequence | null>(null)

  const activeBySeq = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of enrollments) if (e.status === "active") map.set(e.sequenceId, (map.get(e.sequenceId) ?? 0) + 1)
    return map
  }, [enrollments])

  const totals = useMemo(() => {
    const t = sequences.reduce(
      (acc, q) => ({
        enrolled: acc.enrolled + q.stats.enrolled,
        sent: acc.sent + q.stats.sent,
        opened: acc.opened + q.stats.opened,
        replied: acc.replied + q.stats.replied,
        meetings: acc.meetings + q.stats.meetings,
      }),
      { enrolled: 0, sent: 0, opened: 0, replied: 0, meetings: 0 },
    )
    return { ...t, active: [...activeBySeq.values()].reduce((a, b) => a + b, 0) }
  }, [sequences, activeBySeq])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sequences.filter(
      (s) =>
        (status === "all" || s.status === status) &&
        (!q || s.name.toLowerCase().includes(q) || (lookup.user(s.ownerId)?.name.toLowerCase().includes(q) ?? false)),
    )
  }, [sequences, query, status, lookup])

  const toggleStatus = (s: Sequence) => {
    const next = s.status === "active" ? "paused" : "active"
    if (next === "active" && s.steps.length === 0) {
      toast.error("Add at least one step before activating")
      return
    }
    updateSequence(s.id, { status: next })
    toast.success(next === "active" ? "Sequence activated" : "Sequence paused", { description: s.name })
  }

  const duplicate = (s: Sequence) => {
    const id = duplicateSequence(s.id)
    toast.success("Sequence duplicated", {
      description: `${s.name} (copy)`,
      action: { label: "Open", onClick: () => router.push(`/outreach/${id}`) },
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Enrolled" value={number(totals.enrolled)} icon={UsersIcon} hint={`${totals.active} currently active`} />
        <StatCard label="Emails sent" value={number(totals.sent)} icon={SendIcon} hint={`${sequences.length} sequences`} />
        <StatCard label="Open rate" value={percent(rate(totals.opened, totals.sent))} icon={EyeIcon} hint={`${number(totals.opened)} opens`} />
        <StatCard label="Reply rate" value={percent(rate(totals.replied, totals.sent))} icon={ReplyIcon} hint={`${number(totals.replied)} replies`} />
        <StatCard
          label="Meetings booked"
          value={number(totals.meetings)}
          icon={CalendarCheckIcon}
          hint={`${percent(rate(totals.meetings, totals.replied))} of replies`}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search sequences or owners…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
        <div className="sm:ml-auto">
          <NewSequenceDialog />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title={sequences.length === 0 ? "No sequences yet" : "No sequences match"}
          description={sequences.length === 0 ? "Create your first multi-channel sequence." : "Try a different search or status filter."}
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
              {filtered.map((s) => {
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
                      <OwnerLabel user={lookup.user(s.ownerId)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div>{number(s.stats.enrolled)}</div>
                      <div className="text-xs text-muted-foreground">{activeBySeq.get(s.id) ?? 0} active</div>
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
          deleteSequence(toDelete.id)
          toast.success("Sequence deleted", { description: toDelete.name })
          setToDelete(null)
        }}
      />
    </div>
  )
}
