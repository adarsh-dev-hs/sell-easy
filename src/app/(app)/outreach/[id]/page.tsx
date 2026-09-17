"use client"

import { useState } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnrollDialog } from "@/components/outreach/enroll-dialog"
import { SequenceEnrolled } from "@/components/outreach/sequence-enrolled"
import { SequencePerformance } from "@/components/outreach/sequence-performance"
import { SequenceSettings } from "@/components/outreach/sequence-settings"
import { SequenceSteps } from "@/components/outreach/sequence-steps"
import { UserAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryError } from "@/components/shared/query-state"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status"
import {
  ApiError,
  canWrite,
  type SequenceRecord,
  useCurrentUser,
  useDeleteSequence,
  useDuplicateSequence,
  useSequence,
  useSequenceEnrollments,
  useSequencePerformance,
  useUpdateSequence,
  useUsers,
} from "@/lib/api"
import { number, percent, shortDate } from "@/lib/format"

function NameEditor({ sequence, readOnly }: { sequence: SequenceRecord; readOnly: boolean }) {
  const updateSequence = useUpdateSequence()
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
      updateSequence.mutate({ id: sequence.id, name }, { onSuccess: () => toast.success("Sequence renamed") })
    }
  }

  if (readOnly) return <span className="block truncate">{sequence.name}</span>

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

const ENROLLMENT_TOTAL = { pageSize: 1 } as const

function DetailSkeleton() {
  return (
    <>
      <div className="space-y-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[6.5rem] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </>
  )
}

export default function SequenceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const me = useCurrentUser()
  const writable = canWrite(me.role)
  const sequenceQuery = useSequence(id)
  const enrollmentTotal = useSequenceEnrollments(id, ENROLLMENT_TOTAL)
  const performance = useSequencePerformance(id)
  const { data: users } = useUsers()
  const updateSequence = useUpdateSequence()
  const duplicateSequence = useDuplicateSequence()
  const deleteSequence = useDeleteSequence()
  const [tab, setTab] = useState("steps")

  const sequence = sequenceQuery.data

  if (sequenceQuery.isPending) return <DetailSkeleton />

  if (!sequence) {
    const notFound = sequenceQuery.error instanceof ApiError && sequenceQuery.error.status === 404
    if (!notFound) {
      return <QueryError error={sequenceQuery.error} onRetry={() => sequenceQuery.refetch()} title="Couldn't load sequence" />
    }
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
  const rates = performance.data?.rates
  const totalEnrolled = enrollmentTotal.data?.meta.total ?? 0
  const owner =
    users?.find((u) => u.id === sequence.ownerId) ??
    (sequence.ownerName ? { name: sequence.ownerName, avatarColor: "bg-muted-foreground" } : null)

  const toggleStatus = () => {
    const next = sequence.status === "active" ? "paused" : "active"
    updateSequence.mutate(
      { id: sequence.id, status: next },
      {
        onSuccess: () => {
          toast.success(next === "active" ? "Sequence activated" : "Sequence paused")
          if (next === "active" && sequence.steps.some((s) => s.channel === "email") && sequence.mailboxIds.length === 0) {
            toast.warning("No mailboxes selected", { description: "Email steps won't send until you add one in Settings." })
          }
        },
      },
    )
  }

  const duplicate = () => {
    duplicateSequence.mutate(sequence.id, {
      onSuccess: (copy) => {
        toast.success("Sequence duplicated", { description: copy.name })
        router.push(`/outreach/${copy.id}`)
      },
    })
  }

  const enrollAction = writable ? <EnrollDialog sequence={sequence} /> : null

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
              <NameEditor key={sequence.id + sequence.name} sequence={sequence} readOnly={!writable} />
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
          {writable && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={toggleStatus} disabled={updateSequence.isPending}>
                {sequence.status === "active" ? <PauseIcon /> : <PlayIcon />}
                {sequence.status === "active" ? "Pause" : "Activate"}
              </Button>
              <Button variant="outline" onClick={duplicate} disabled={duplicateSequence.isPending}>
                <CopyIcon /> Duplicate
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2Icon /> Delete
                  </Button>
                }
                title={`Delete “${sequence.name}”?`}
                description={`This removes the sequence and its ${totalEnrolled} enrollment${totalEnrolled === 1 ? "" : "s"}. This cannot be undone.`}
                confirmLabel="Delete sequence"
                onConfirm={() => {
                  // Leave first so the detail query doesn't flash "not found" when it's invalidated.
                  router.push("/outreach")
                  deleteSequence.mutate(sequence.id)
                }}
              />
              {enrollAction}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Enrolled" value={number(stats.enrolled)} icon={UsersIcon} hint={`${sequence.activeEnrollments} active now`} />
        <StatCard label="Sent" value={number(stats.sent)} icon={SendIcon} />
        <StatCard label="Opened" value={number(stats.opened)} icon={EyeIcon} hint={rates ? `${percent(rates.openRate)} open rate` : undefined} />
        <StatCard label="Replied" value={number(stats.replied)} icon={ReplyIcon} hint={rates ? `${percent(rates.replyRate)} reply rate` : undefined} />
        <StatCard
          label="Meetings"
          value={number(stats.meetings)}
          icon={CalendarCheckIcon}
          hint={rates ? `${percent(rates.meetingRate)} of replies` : undefined}
        />
        <StatCard label="Bounced" value={number(stats.bounced)} icon={MailXIcon} hint={rates ? `${percent(rates.bounceRate)} bounce rate` : undefined} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="enrolled">
              Enrolled <span className="text-xs text-muted-foreground tabular-nums">{totalEnrolled}</span>
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="steps">
          <SequenceSteps sequence={sequence} readOnly={!writable} />
        </TabsContent>
        <TabsContent value="enrolled">
          <SequenceEnrolled sequence={sequence} enrollAction={enrollAction} readOnly={!writable} />
        </TabsContent>
        <TabsContent value="settings">
          <SequenceSettings sequence={sequence} readOnly={!writable} />
        </TabsContent>
        <TabsContent value="performance">
          <SequencePerformance sequence={sequence} />
        </TabsContent>
      </Tabs>
    </>
  )
}
