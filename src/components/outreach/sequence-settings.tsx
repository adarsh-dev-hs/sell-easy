"use client"

import { useState } from "react"
import { GlobeIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { StatusBadge } from "@/components/shared/status"
import { type SequenceRecord, useMailboxes, useSession, useUpdateSequence, useUsers } from "@/lib/api"
import type { SequenceSettings as Settings } from "@/lib/types"

/** Index = API day number (0 = Monday … 6 = Sunday). */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`,
}))
const COMMON_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
]

export function SequenceSettings({ sequence, readOnly = false }: { sequence: SequenceRecord; readOnly?: boolean }) {
  const users = useUsers().data ?? []
  const mailboxesQuery = useMailboxes()
  const mailboxes = mailboxesQuery.data ?? []
  const updateSequence = useUpdateSequence()

  const toggleMailbox = (id: string, on: boolean) => {
    const next = on ? [...sequence.mailboxIds, id] : sequence.mailboxIds.filter((x) => x !== id)
    const email = mailboxes.find((m) => m.id === id)?.email
    updateSequence.mutate(
      { id: sequence.id, mailboxIds: next },
      {
        onSuccess: () =>
          toast.success(on ? "Mailbox added to rotation" : "Mailbox removed from rotation", { description: email }),
      },
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Ownership & mailboxes</CardTitle>
          <CardDescription>{readOnly ? "You have read-only access." : "Changes save immediately."}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="settings-owner">Sequence owner</FieldLabel>
              <Select
                value={sequence.ownerId}
                disabled={readOnly}
                onValueChange={(v) =>
                  updateSequence.mutate(
                    { id: sequence.id, ownerId: v },
                    { onSuccess: () => toast.success("Owner updated", { description: users.find((u) => u.id === v)?.name }) },
                  )
                }
              >
                <SelectTrigger id="settings-owner" className="w-full">
                  <SelectValue placeholder={sequence.ownerName ?? "Select owner"} />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.status === "active" || u.id === sequence.ownerId)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FieldDescription>Replies and call tasks are routed to the owner.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Sending mailboxes</FieldLabel>
              <FieldDescription>
                {sequence.mailboxIds.length === 0
                  ? "No mailboxes selected — email steps can't send."
                  : `Rotating across ${sequence.mailboxIds.length} mailbox${sequence.mailboxIds.length === 1 ? "" : "es"}.`}
              </FieldDescription>
              <div className="space-y-1 rounded-lg border p-2">
                {mailboxesQuery.isPending &&
                  Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="m-2 h-5" />)}
                {mailboxesQuery.isError && (
                  <p className="p-2 text-sm text-destructive">Couldn&apos;t load mailboxes.</p>
                )}
                {mailboxesQuery.isSuccess && mailboxes.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">No mailboxes connected.</p>
                )}
                {mailboxes.map((m) => (
                  <Label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 font-normal hover:bg-muted/60">
                    <Checkbox
                      checked={sequence.mailboxIds.includes(m.id)}
                      disabled={readOnly || updateSequence.isPending}
                      onCheckedChange={(v) => toggleMailbox(m.id, !!v)}
                    />
                    <span className="min-w-0 flex-1 truncate">{m.email}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {m.sentToday}/{m.dailyLimit} today
                    </span>
                    <StatusBadge status={m.status} />
                  </Label>
                ))}
              </div>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Re-mount the form whenever the saved settings change so local edits start from the server values. */}
      <SendingWindowCard key={JSON.stringify(sequence.settings ?? null)} sequence={sequence} readOnly={readOnly} />
    </div>
  )
}

function SendingWindowCard({ sequence, readOnly }: { sequence: SequenceRecord; readOnly: boolean }) {
  const { org } = useSession()
  const updateSequence = useUpdateSequence()

  const initial: Settings = sequence.settings ?? {
    sendDays: [0, 1, 2, 3, 4],
    startHour: 8,
    endHour: 17,
    timezone: org?.timezone ?? "UTC",
    stopOnReply: true,
    trackOpens: true,
  }
  const [form, setForm] = useState<Settings>(initial)
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((f) => ({ ...f, [key]: value }))

  const timezones = [...new Set([form.timezone, org?.timezone, ...COMMON_TIMEZONES].filter((t): t is string => !!t))]
  const dirty = !sequence.settings || !sameSettings(form, initial)
  const invalid = form.sendDays.length === 0 ? "Pick at least one sending day" : form.endHour <= form.startHour ? "End hour must be after start hour" : null

  const save = () => {
    if (invalid) {
      toast.error(invalid)
      return
    }
    updateSequence.mutate(
      { id: sequence.id, settings: form },
      {
        onSuccess: () =>
          toast.success("Sending settings saved", {
            description: `${form.sendDays.map((d) => DAYS[d]).join(", ")} · ${HOURS[form.startHour].label}–${HOURS[form.endHour].label}`,
          }),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sending window & tracking</CardTitle>
        <CardDescription>When and how this sequence sends.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Sending days</FieldLabel>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              spacing={0}
              disabled={readOnly}
              value={form.sendDays.map(String)}
              onValueChange={(v) => set("sendDays", v.map(Number).sort((a, b) => a - b))}
              className="flex-wrap"
            >
              {DAYS.map((d, i) => (
                <ToggleGroupItem key={d} value={String(i)} className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  {d}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="win-start">Start</FieldLabel>
              <Select value={String(form.startHour)} onValueChange={(v) => set("startHour", Number(v))} disabled={readOnly}>
                <SelectTrigger id="win-start" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={form.endHour <= form.startHour || undefined}>
              <FieldLabel htmlFor="win-end">End</FieldLabel>
              <Select value={String(form.endHour)} onValueChange={(v) => set("endHour", Number(v))} disabled={readOnly}>
                <SelectTrigger id="win-end" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {invalid && <FieldError>{invalid}</FieldError>}
          <Field>
            <FieldLabel htmlFor="win-tz" className="flex items-center gap-1.5">
              <GlobeIcon className="size-3.5" /> Timezone
            </FieldLabel>
            <Select value={form.timezone} onValueChange={(v) => set("timezone", v)} disabled={readOnly}>
              <SelectTrigger id="win-tz" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                    {tz === org?.timezone ? " (organization)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <SwitchField
            id="stop-reply"
            label="Stop on reply"
            description="Pause a contact's enrollment as soon as they reply."
            checked={form.stopOnReply}
            disabled={readOnly}
            onChange={(v) => set("stopOnReply", v)}
          />
          <SwitchField
            id="track-opens"
            label="Track opens"
            description="Adds an invisible pixel. Disable for better deliverability."
            checked={form.trackOpens}
            disabled={readOnly}
            onChange={(v) => set("trackOpens", v)}
          />
        </FieldGroup>
      </CardContent>
      {!readOnly && (
        <CardFooter className="justify-end border-t">
          <Button onClick={save} disabled={!dirty || !!invalid || updateSequence.isPending}>
            <SaveIcon /> {updateSequence.isPending ? "Saving…" : "Save settings"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function sameSettings(a: Settings, b: Settings) {
  return (
    a.sendDays.join() === b.sendDays.join() &&
    a.startHour === b.startHour &&
    a.endHour === b.endHour &&
    a.timezone === b.timezone &&
    a.stopOnReply === b.stopOnReply &&
    a.trackOpens === b.trackOpens
  )
}

function SwitchField({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </Field>
  )
}
