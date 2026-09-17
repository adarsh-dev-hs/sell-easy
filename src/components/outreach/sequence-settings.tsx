"use client"

import { useState } from "react"
import { GlobeIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { StatusBadge } from "@/components/shared/status"
import { useStore } from "@/lib/store"
import type { Sequence } from "@/lib/types"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`,
}))

export function SequenceSettings({ sequence }: { sequence: Sequence }) {
  const users = useStore((s) => s.users)
  const mailboxes = useStore((s) => s.mailboxes)
  const timezone = useStore((s) => s.org.timezone)
  const updateSequence = useStore((s) => s.updateSequence)

  const [days, setDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"])
  const [start, setStart] = useState("8")
  const [end, setEnd] = useState("17")
  const [prospectTz, setProspectTz] = useState(true)
  const [stopOnReply, setStopOnReply] = useState(true)
  const [trackOpens, setTrackOpens] = useState(true)
  const [trackClicks, setTrackClicks] = useState(false)

  const toggleMailbox = (id: string, on: boolean) => {
    const next = on ? [...sequence.mailboxIds, id] : sequence.mailboxIds.filter((x) => x !== id)
    updateSequence(sequence.id, { mailboxIds: next })
    const email = mailboxes.find((m) => m.id === id)?.email
    toast.success(on ? "Mailbox added to rotation" : "Mailbox removed from rotation", { description: email })
  }

  const saveSchedule = () => {
    if (days.length === 0) {
      toast.error("Pick at least one sending day")
      return
    }
    if (Number(end) <= Number(start)) {
      toast.error("End hour must be after start hour")
      return
    }
    toast.success("Sending settings saved", {
      description: `${days.join(", ")} · ${HOURS[Number(start)].label}–${HOURS[Number(end)].label}`,
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Ownership & mailboxes</CardTitle>
          <CardDescription>Changes save immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="settings-owner">Sequence owner</FieldLabel>
              <Select
                value={sequence.ownerId}
                onValueChange={(v) => {
                  updateSequence(sequence.id, { ownerId: v })
                  toast.success("Owner updated", { description: users.find((u) => u.id === v)?.name })
                }}
              >
                <SelectTrigger id="settings-owner" className="w-full">
                  <SelectValue />
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
                {mailboxes.length === 0 && <p className="p-2 text-sm text-muted-foreground">No mailboxes connected.</p>}
                {mailboxes.map((m) => (
                  <Label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 font-normal hover:bg-muted/60">
                    <Checkbox
                      checked={sequence.mailboxIds.includes(m.id)}
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
                value={days}
                onValueChange={(v) => setDays(DAYS.filter((d) => v.includes(d)))}
                className="flex-wrap"
              >
                {DAYS.map((d) => (
                  <ToggleGroupItem key={d} value={d} className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    {d}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="win-start">Start</FieldLabel>
                <Select value={start} onValueChange={setStart}>
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
              <Field>
                <FieldLabel htmlFor="win-end">End</FieldLabel>
                <Select value={end} onValueChange={setEnd}>
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
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GlobeIcon className="size-3.5" /> Organization timezone: {timezone}
            </p>
            <SwitchField
              id="prospect-tz"
              label="Send in prospect's timezone"
              description="Use each contact's location instead of the org timezone."
              checked={prospectTz}
              onChange={setProspectTz}
            />
            <SwitchField
              id="stop-reply"
              label="Stop on reply"
              description="Pause a contact's enrollment as soon as they reply."
              checked={stopOnReply}
              onChange={setStopOnReply}
            />
            <SwitchField
              id="track-opens"
              label="Track opens"
              description="Adds an invisible pixel. Disable for better deliverability."
              checked={trackOpens}
              onChange={setTrackOpens}
            />
            <SwitchField
              id="track-clicks"
              label="Track link clicks"
              description="Rewrites links through your custom tracking domain."
              checked={trackClicks}
              onChange={setTrackClicks}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button onClick={saveSchedule}>
            <SaveIcon /> Save settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function SwitchField({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}
