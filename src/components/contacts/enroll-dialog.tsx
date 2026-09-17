"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PersonAvatar } from "@/components/shared/avatars"
import { StatusBadge } from "@/components/shared/status"
import { fullName } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { Contact } from "@/lib/types"

/**
 * Enroll contacts into a sequence.
 * - `contactIds`: contacts to enroll (or pre-selected, when `choices` is given)
 * - `choices`: when provided, the user can pick which of these contacts to enroll.
 */
export function EnrollDialog({
  open,
  onOpenChange,
  contactIds,
  choices,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactIds: string[]
  choices?: Contact[]
  onDone?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <EnrollForm
            contactIds={contactIds}
            choices={choices}
            onClose={() => onOpenChange(false)}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EnrollForm({
  contactIds,
  choices,
  onClose,
  onDone,
}: {
  contactIds: string[]
  choices?: Contact[]
  onClose: () => void
  onDone?: () => void
}) {
  const sequences = useStore((s) => s.sequences)
  const enrollContacts = useStore((s) => s.enrollContacts)
  const available = useMemo(() => sequences.filter((s) => s.status !== "draft"), [sequences])
  const [sequenceId, setSequenceId] = useState(available[0]?.id ?? "")
  const [picked, setPicked] = useState<string[]>(contactIds)

  const ids = choices ? picked : contactIds

  const submit = () => {
    const seq = sequences.find((s) => s.id === sequenceId)
    if (!seq || ids.length === 0) return
    const n = enrollContacts(ids, sequenceId)
    const skipped = ids.length - n
    if (n === 0) {
      toast.warning(`No contacts enrolled in “${seq.name}”`, {
        description: `${skipped} skipped (already enrolled, invalid email, bounced or unsubscribed).`,
      })
    } else {
      toast.success(`Enrolled ${n} contact${n === 1 ? "" : "s"} in “${seq.name}”`, {
        description: skipped ? `${skipped} skipped (already enrolled, invalid email, bounced or unsubscribed).` : undefined,
      })
    }
    onDone?.()
    onClose()
  }

  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)))

  return (
    <>
      <DialogHeader>
        <DialogTitle>Enroll in sequence</DialogTitle>
        <DialogDescription>
          {choices ? "Pick contacts and a sequence." : `${contactIds.length} contact${contactIds.length === 1 ? "" : "s"} selected.`} Contacts
          that are already enrolled, bounced, unsubscribed or have invalid emails are skipped.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>Sequence</FieldLabel>
          <Select value={sequenceId} onValueChange={setSequenceId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a sequence" />
            </SelectTrigger>
            <SelectContent>
              {available.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {s.steps.length} steps{s.status === "paused" ? " (paused)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {available.length === 0 && <FieldDescription>No active sequences. Create one under Outreach first.</FieldDescription>}
        </Field>
        {choices && (
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel>Contacts</FieldLabel>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setPicked(picked.length === choices.length ? [] : choices.map((c) => c.id))}
              >
                {picked.length === choices.length ? "Clear all" : "Select all"}
              </Button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
              {choices.length === 0 && <p className="p-3 text-sm text-muted-foreground">No contacts on this account yet.</p>}
              {choices.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/60">
                  <Checkbox checked={picked.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v === true)} />
                  <PersonAvatar name={fullName(c)} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{fullName(c)}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.title}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </label>
              ))}
            </div>
          </Field>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!sequenceId || ids.length === 0} onClick={submit}>
          Enroll {ids.length || ""}
        </Button>
      </DialogFooter>
    </>
  )
}
