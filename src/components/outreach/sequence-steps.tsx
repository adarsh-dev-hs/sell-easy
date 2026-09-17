"use client"

import { useMemo, useState } from "react"
import { ArrowDownIcon, ArrowUpIcon, BracesIcon, EyeIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { STEP_CHANNEL_LABELS } from "@/lib/constants"
import { fullName } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Sequence, SequenceStep, StepChannel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { STEP_CHANNEL_DESCRIPTIONS, STEP_CHANNEL_ICONS, StepChannelIcon, VARIABLES, fillTemplate } from "./channel"

type Draft = { subject?: string; body?: string }

function StepCard({
  sequenceId,
  step,
  index,
  total,
  selected,
  draft,
  onSelect,
  onDraft,
}: {
  sequenceId: string
  step: SequenceStep
  index: number
  total: number
  selected: boolean
  draft?: Draft
  onSelect: () => void
  onDraft: (d: Draft | undefined) => void
}) {
  const updateStep = useStore((s) => s.updateStep)
  const removeStep = useStore((s) => s.removeStep)
  const moveStep = useStore((s) => s.moveStep)

  const subject = draft?.subject ?? step.subject ?? ""
  const body = draft?.body ?? step.body ?? ""

  const commit = () => {
    if (!draft) return
    const patch: Partial<SequenceStep> = {}
    if (draft.subject !== undefined && draft.subject !== (step.subject ?? "")) patch.subject = draft.subject
    if (draft.body !== undefined && draft.body !== (step.body ?? "")) patch.body = draft.body
    onDraft(undefined)
    if (Object.keys(patch).length) {
      updateStep(sequenceId, step.id, patch)
      toast.success("Step saved", { description: `Step ${index + 1} · ${STEP_CHANNEL_LABELS[step.channel]}` })
    }
  }

  const commitDay = (raw: string, input: HTMLInputElement) => {
    const n = Math.round(Number(raw))
    if (!Number.isFinite(n) || n < 0) {
      input.value = String(step.dayOffset)
      toast.error("Day offset must be 0 or more")
      return
    }
    if (n !== step.dayOffset) {
      updateStep(sequenceId, step.id, { dayOffset: n })
      toast.success(`Step ${index + 1} moved to day ${n}`)
    }
  }

  const hasBody = step.channel === "email" || step.channel === "linkedin_message"

  return (
    <Card
      size="sm"
      onClick={step.channel === "email" ? onSelect : undefined}
      className={cn("gap-3 transition-shadow", step.channel === "email" && "cursor-pointer", selected && "ring-2 ring-primary")}
    >
      <CardHeader className="flex flex-wrap items-center gap-3">
        <StepChannelIcon channel={step.channel} />
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2">
            Step {index + 1} · {STEP_CHANNEL_LABELS[step.channel]}
            {selected && (
              <Badge variant="secondary" className="gap-1">
                <EyeIcon className="size-3" /> Previewing
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{STEP_CHANNEL_DESCRIPTIONS[step.channel]}</CardDescription>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Label htmlFor={`day-${step.id}`} className="text-xs font-normal text-muted-foreground">
            Day
          </Label>
          <Input
            key={`${step.id}-${step.dayOffset}`}
            id={`day-${step.id}`}
            type="number"
            min={0}
            defaultValue={step.dayOffset}
            className="h-7 w-16"
            onBlur={(e) => commitDay(e.target.value, e.target)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => moveStep(sequenceId, step.id, -1)}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move down"
            disabled={index === total - 1}
            onClick={() => moveStep(sequenceId, step.id, 1)}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete step"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              removeStep(sequenceId, step.id)
              toast.success("Step removed", { description: `${STEP_CHANNEL_LABELS[step.channel]} on day ${step.dayOffset}` })
            }}
          >
            <Trash2Icon />
          </Button>
        </div>
      </CardHeader>
      {hasBody && (
        <CardContent className="space-y-2" onClick={(e) => e.stopPropagation()}>
          {step.channel === "email" && (
            <Input
              aria-label="Subject"
              placeholder="Subject line"
              value={subject}
              onFocus={onSelect}
              onChange={(e) => onDraft({ ...draft, subject: e.target.value })}
              onBlur={commit}
            />
          )}
          <Textarea
            aria-label="Message body"
            placeholder={step.channel === "email" ? "Write your email… use {{first_name}} to personalize" : "LinkedIn message…"}
            className="min-h-28"
            value={body}
            onFocus={step.channel === "email" ? onSelect : undefined}
            onChange={(e) => onDraft({ ...draft, body: e.target.value })}
            onBlur={commit}
          />
        </CardContent>
      )}
    </Card>
  )
}

export function SequenceSteps({ sequence }: { sequence: Sequence }) {
  const addStep = useStore((s) => s.addStep)
  const enrollments = useStore((s) => s.enrollments)
  const contacts = useStore((s) => s.contacts)
  const accounts = useStore((s) => s.accounts)
  const lookup = useLookup()

  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [previewStepId, setPreviewStepId] = useState<string | null>(null)
  const [previewContactId, setPreviewContactId] = useState<string | null>(null)

  const emailSteps = sequence.steps.filter((s) => s.channel === "email")
  const previewStep = emailSteps.find((s) => s.id === previewStepId) ?? emailSteps[0]

  const sampleContacts = useMemo(() => {
    const ids = new Set(enrollments.filter((e) => e.sequenceId === sequence.id).map((e) => e.contactId))
    const enrolled = contacts.filter((c) => ids.has(c.id))
    return (enrolled.length ? enrolled : contacts).slice(0, 50)
  }, [enrollments, contacts, sequence.id])

  const sample = sampleContacts.find((c) => c.id === previewContactId) ?? sampleContacts[0]
  const sampleAccount = lookup.account(sample?.accountId)
  const owner = lookup.user(sequence.ownerId)
  const similarCustomer = useMemo(
    () => accounts.find((a) => a.stage === "customer" && a.id !== sample?.accountId && a.industry === sampleAccount?.industry)?.name ??
      accounts.find((a) => a.stage === "customer" && a.id !== sample?.accountId)?.name ??
      "Northwind",
    [accounts, sample?.accountId, sampleAccount?.industry],
  )

  const vars = {
    first_name: sample?.firstName ?? "Alex",
    last_name: sample?.lastName ?? "Doe",
    company: sampleAccount?.name ?? "Acme",
    title: sample?.title ?? "",
    sender_name: owner?.name.split(" ")[0] ?? "Jordan",
    similar_customer: similarCustomer,
    funding_round: sampleAccount?.fundingStage ?? "Series B",
  }

  const add = (channel: StepChannel) => {
    const last = sequence.steps.reduce((m, s) => Math.max(m, s.dayOffset), -2)
    const dayOffset = sequence.steps.length ? last + 2 : 0
    addStep(sequence.id, {
      channel,
      dayOffset,
      ...(channel === "email" ? { subject: "", body: "" } : channel === "linkedin_message" ? { body: "" } : {}),
    })
    toast.success(`${STEP_CHANNEL_LABELS[channel]} step added`, { description: `Day ${dayOffset}` })
  }

  const copyVar = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v)
      toast.success(`Copied ${v}`)
    } catch {
      toast.error("Clipboard unavailable")
    }
  }

  const setDraft = (id: string, d: Draft | undefined) =>
    setDrafts((prev) => {
      const next = { ...prev }
      if (d) next[id] = d
      else delete next[id]
      return next
    })

  const previewSubject = previewStep ? (drafts[previewStep.id]?.subject ?? previewStep.subject ?? "") : ""
  const previewBody = previewStep ? (drafts[previewStep.id]?.body ?? previewStep.body ?? "") : ""

  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <PlusIcon /> Add step
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {(Object.keys(STEP_CHANNEL_LABELS) as StepChannel[]).map((c) => {
          const Icon = STEP_CHANNEL_ICONS[c]
          return (
            <DropdownMenuItem key={c} onSelect={() => add(c)}>
              <Icon /> {STEP_CHANNEL_LABELS[c]}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        {sequence.steps.length === 0 ? (
          <EmptyState title="No steps yet" description="Add an email, LinkedIn touch or call task to get started." action={addMenu} />
        ) : (
          <ol className="relative space-y-4">
            {sequence.steps.map((step, i) => (
              <li key={step.id} className="relative flex gap-3 sm:gap-4">
                <div className="flex w-12 shrink-0 flex-col items-center">
                  <div className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums">
                    Day {step.dayOffset}
                  </div>
                  {i < sequence.steps.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="min-w-0 flex-1">
                  <StepCard
                    sequenceId={sequence.id}
                    step={step}
                    index={i}
                    total={sequence.steps.length}
                    selected={step.id === previewStep?.id}
                    draft={drafts[step.id]}
                    onSelect={() => setPreviewStepId(step.id)}
                    onDraft={(d) => setDraft(step.id, d)}
                  />
                </div>
              </li>
            ))}
            <li className="flex gap-3 sm:gap-4">
              <div className="w-12 shrink-0" />
              {addMenu}
            </li>
          </ol>
        )}
      </div>

      <div className="space-y-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BracesIcon className="size-4" /> Personalization
            </CardTitle>
            <CardDescription>Click a variable to copy it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {VARIABLES.map((v) => (
              <Button key={v} variant="secondary" size="xs" className="font-mono" onClick={() => copyVar(v)}>
                {v}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card size="sm" className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EyeIcon className="size-4" /> Preview
            </CardTitle>
            <CardDescription>
              {previewStep
                ? `Step ${sequence.steps.indexOf(previewStep) + 1} · Day ${previewStep.dayOffset}`
                : "Add an email step to preview it."}
            </CardDescription>
          </CardHeader>
          {previewStep && (
            <CardContent className="space-y-3">
              <Select value={sample?.id ?? ""} onValueChange={setPreviewContactId} disabled={!sampleContacts.length}>
                <SelectTrigger className="w-full" aria-label="Preview as contact">
                  <SelectValue placeholder="Choose a contact" />
                </SelectTrigger>
                <SelectContent>
                  {sampleContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {fullName(c)} · {lookup.account(c.accountId)?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-lg border bg-muted/30 text-sm">
                <div className="space-y-1 p-3 text-xs">
                  <div className="flex gap-2">
                    <span className="w-10 text-muted-foreground">From</span>
                    <span className="truncate">{owner?.name ?? "Sender"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-10 text-muted-foreground">To</span>
                    <span className="truncate">{sample ? `${fullName(sample)} <${sample.email}>` : "—"}</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 p-3">
                  <div className="font-medium">{fillTemplate(previewSubject, vars) || <span className="text-muted-foreground">(no subject)</span>}</div>
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {fillTemplate(previewBody, vars) || "(empty body)"}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
