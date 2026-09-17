"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  CopyIcon,
  EyeIcon,
  MailXIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  ReplyIcon,
  SendIcon,
  Trash2Icon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnrollDialog } from "@/components/outreach/enroll-dialog"
import { SequenceEnrolled } from "@/components/outreach/sequence-enrolled"
import { SequencePerformance } from "@/components/outreach/sequence-performance"
import { SequenceSettings } from "@/components/outreach/sequence-settings"
import { SequenceSteps } from "@/components/outreach/sequence-steps"
import { rate } from "@/components/outreach/channel"
import { UserAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status"
import { number, percent, shortDate } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Sequence } from "@/lib/types"

function NameEditor({ sequence }: { sequence: Sequence }) {
  const updateSequence = useStore((s) => s.updateSequence)
  const [value, setValue] = useState(sequence.name)
  const [editing, setEditing] = useState(false)

  const commit = () => {
    const name = value.trim()
    setEditing(false)
    if (!name) {
      setValue(sequence.name)
      toast.error("Name can't be empty")
      return
    }
    if (name !== sequence.name) {
      updateSequence(sequence.id, { name })
      toast.success("Sequence renamed")
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(sequence.name)
          setEditing(true)
        }}
        className="group -mx-1 flex max-w-full items-center gap-2 rounded-md px-1 text-left hover:bg-muted/60"
        title="Rename sequence"
      >
        <span className="truncate">{sequence.name}</span>
        <PencilIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    )
  }

  return (
    <Input
      autoFocus
      aria-label="Sequence name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") {
          setValue(sequence.name)
          setEditing(false)
        }
      }}
      className="h-9 max-w-xl text-xl font-semibold md:text-xl"
    />
  )
}

export default function SequenceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const sequence = useStore((s) => s.sequences.find((q) => q.id === id))
  const enrollments = useStore((s) => s.enrollments)
  const updateSequence = useStore((s) => s.updateSequence)
  const duplicateSequence = useStore((s) => s.duplicateSequence)
  const deleteSequence = useStore((s) => s.deleteSequence)
  const lookup = useLookup()
  const [tab, setTab] = useState("steps")

  const counts = useMemo(() => {
    let active = 0
    let total = 0
    for (const e of enrollments) {
      if (e.sequenceId !== id) continue
      total++
      if (e.status === "active") active++
    }
    return { active, total }
  }, [enrollments, id])

  if (!sequence) {
    return (
      <EmptyState
        icon={WorkflowIcon}
        title="Sequence not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link href="/outreach">
              <ArrowLeftIcon /> Back to outreach
            </Link>
          </Button>
        }
      />
    )
  }

  const { stats } = sequence
  const owner = lookup.user(sequence.ownerId)

  const toggleStatus = () => {
    const next = sequence.status === "active" ? "paused" : "active"
    if (next === "active") {
      if (sequence.steps.length === 0) return void toast.error("Add at least one step before activating")
      if (sequence.steps.some((s) => s.channel === "email") && sequence.mailboxIds.length === 0) {
        toast.warning("No mailboxes selected", { description: "Email steps won't send until you add one in Settings." })
      }
    }
    updateSequence(sequence.id, { status: next })
    toast.success(next === "active" ? "Sequence activated" : "Sequence paused")
  }

  const duplicate = () => {
    const newId = duplicateSequence(sequence.id)
    toast.success("Sequence duplicated", { description: `${sequence.name} (copy)` })
    router.push(`/outreach/${newId}`)
  }

  const enrollAction = <EnrollDialog sequence={sequence} />

  return (
    <>
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/outreach?tab=sequences">
            <ArrowLeftIcon /> Sequences
          </Link>
        </Button>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              <NameEditor key={sequence.id + sequence.name} sequence={sequence} />
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <StatusBadge status={sequence.status} />
              <span className="flex items-center gap-1.5">
                <UserAvatar user={owner} className="size-5" /> {owner?.name ?? "Unassigned"}
              </span>
              <span>
                {sequence.steps.length} step{sequence.steps.length === 1 ? "" : "s"}
              </span>
              <span>Created {shortDate(sequence.createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={toggleStatus}>
              {sequence.status === "active" ? <PauseIcon /> : <PlayIcon />}
              {sequence.status === "active" ? "Pause" : "Activate"}
            </Button>
            <Button variant="outline" onClick={duplicate}>
              <CopyIcon /> Duplicate
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2Icon /> Delete
                </Button>
              }
              title={`Delete “${sequence.name}”?`}
              description={`This removes the sequence and its ${counts.total} enrollment${counts.total === 1 ? "" : "s"}. This cannot be undone.`}
              confirmLabel="Delete sequence"
              onConfirm={() => {
                const name = sequence.name
                router.push("/outreach")
                deleteSequence(sequence.id)
                toast.success("Sequence deleted", { description: name })
              }}
            />
            {enrollAction}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Enrolled" value={number(stats.enrolled)} icon={UsersIcon} hint={`${counts.active} active now`} />
        <StatCard label="Sent" value={number(stats.sent)} icon={SendIcon} />
        <StatCard label="Opened" value={number(stats.opened)} icon={EyeIcon} hint={`${percent(rate(stats.opened, stats.sent))} open rate`} />
        <StatCard label="Replied" value={number(stats.replied)} icon={ReplyIcon} hint={`${percent(rate(stats.replied, stats.sent))} reply rate`} />
        <StatCard
          label="Meetings"
          value={number(stats.meetings)}
          icon={CalendarCheckIcon}
          hint={`${percent(rate(stats.meetings, stats.replied))} of replies`}
        />
        <StatCard label="Bounced" value={number(stats.bounced)} icon={MailXIcon} hint={`${percent(rate(stats.bounced, stats.sent))} bounce rate`} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="enrolled">
              Enrolled <span className="text-xs text-muted-foreground tabular-nums">{counts.total}</span>
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="steps">
          <SequenceSteps sequence={sequence} />
        </TabsContent>
        <TabsContent value="enrolled">
          <SequenceEnrolled sequence={sequence} enrollAction={enrollAction} />
        </TabsContent>
        <TabsContent value="settings">
          <SequenceSettings sequence={sequence} />
        </TabsContent>
        <TabsContent value="performance">
          <SequencePerformance sequence={sequence} />
        </TabsContent>
      </Tabs>
    </>
  )
}
