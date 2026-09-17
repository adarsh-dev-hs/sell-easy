"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { PersonAvatar } from "@/components/shared/avatars"
import { StatusBadge } from "@/components/shared/status"
import { useBulkEnrollAccounts, useEnrollAccountContacts, useEnrollContacts, useSequences } from "@/lib/api"
import { fullName } from "@/lib/format"
import type { Contact, EnrollResult } from "@/lib/types"

/**
 * What to enroll:
 * - `contacts`: these contact ids
 * - `accounts`: every eligible contact on these accounts (resolved server-side)
 * - `account`: pick from `choices` (contacts of one account)
 */
export type EnrollTarget =
  | { kind: "contacts"; contactIds: string[] }
  | { kind: "accounts"; accountIds: string[] }
  | { kind: "account"; accountId: string; choices: Pick<Contact, "id" | "firstName" | "lastName" | "title" | "status" | "emailStatus">[] }

const ELIGIBLE = (c: Pick<Contact, "status" | "emailStatus">) => !["unsubscribed", "bounced"].includes(c.status) && c.emailStatus !== "invalid"

export function EnrollDialog({
  open,
  onOpenChange,
  target,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: EnrollTarget
  onDone?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <EnrollForm target={target} onClose={() => onOpenChange(false)} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  )
}

function EnrollForm({ target, onClose, onDone }: { target: EnrollTarget; onClose: () => void; onDone?: () => void }) {
  const { data: seqPage, isLoading } = useSequences({ status: ["active", "paused"] })
  const available = seqPage?.data ?? []
  const [picked, setSequenceId] = useState("")
  const sequenceId = picked || available[0]?.id || ""
  const [contactIds, setContactIds] = useState<string[]>(() =>
    target.kind === "account" ? target.choices.filter(ELIGIBLE).map((c) => c.id) : target.kind === "contacts" ? target.contactIds : [],
  )

  const enrollContacts = useEnrollContacts()
  const enrollAccounts = useBulkEnrollAccounts()
  const enrollAccount = useEnrollAccountContacts()
  const pending = enrollContacts.isPending || enrollAccounts.isPending || enrollAccount.isPending

  const count = target.kind === "accounts" ? target.accountIds.length : contactIds.length

  const onSuccess = (r: EnrollResult) => {
    const skippedNote = `${r.skipped} skipped (already enrolled, invalid email, bounced or unsubscribed).`
    if (r.enrolled === 0) {
      toast.warning(`No contacts enrolled in “${r.sequence.name}”`, { description: skippedNote })
    } else {
      toast.success(`Enrolled ${r.enrolled} contact${r.enrolled === 1 ? "" : "s"} in “${r.sequence.name}”`, {
        description: r.skipped ? skippedNote : undefined,
      })
    }
    onDone?.()
    onClose()
  }

  const submit = () => {
    if (!sequenceId || count === 0) return
    if (target.kind === "contacts") enrollContacts.mutate({ contactIds, sequenceId }, { onSuccess })
    else if (target.kind === "accounts") enrollAccounts.mutate({ ids: target.accountIds, sequenceId }, { onSuccess })
    else enrollAccount.mutate({ id: target.accountId, sequenceId, contactIds }, { onSuccess })
  }

  const toggle = (id: string, on: boolean) => setContactIds((p) => (on ? [...p, id] : p.filter((x) => x !== id)))

  const description =
    target.kind === "account"
      ? "Pick contacts and a sequence."
      : target.kind === "accounts"
        ? `Contacts on ${count} selected account${count === 1 ? "" : "s"} will be enrolled.`
        : `${count} contact${count === 1 ? "" : "s"} selected.`

  return (
    <>
      <DialogHeader>
        <DialogTitle>Enroll in sequence</DialogTitle>
        <DialogDescription>
          {description} Contacts that are already enrolled, bounced, unsubscribed or have invalid emails are skipped.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>Sequence</FieldLabel>
          {isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
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
          )}
          {!isLoading && available.length === 0 && (
            <FieldDescription>No active sequences. Create one under Outreach first.</FieldDescription>
          )}
        </Field>
        {target.kind === "account" && (
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel>Contacts</FieldLabel>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setContactIds(contactIds.length === target.choices.length ? [] : target.choices.map((c) => c.id))}
              >
                {contactIds.length === target.choices.length ? "Clear all" : "Select all"}
              </Button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
              {target.choices.length === 0 && <p className="p-3 text-sm text-muted-foreground">No contacts on this account yet.</p>}
              {target.choices.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/60">
                  <Checkbox checked={contactIds.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v === true)} />
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
        <Button disabled={!sequenceId || count === 0 || pending} onClick={submit}>
          {pending && <Loader2Icon className="animate-spin" />}
          Enroll{target.kind === "accounts" ? "" : ` ${count || ""}`}
        </Button>
      </DialogFooter>
    </>
  )
}
