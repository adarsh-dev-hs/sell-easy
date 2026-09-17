"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ExternalLinkIcon, ListPlusIcon, Loader2Icon, MailCheckIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { ActivityTimeline } from "@/components/accounts/activity-timeline"
import { CompanyAvatar, OwnerLabel, PersonAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { humanize, StatusBadge } from "@/components/shared/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { fullName, shortDate, timeAgo } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Contact } from "@/lib/types"
import { CONTACT_STATUSES } from "./options"
import { EnrollDialog } from "./enroll-dialog"

export function ContactSheet({ contactId, onOpenChange }: { contactId: string | null; onOpenChange: (open: boolean) => void }) {
  const contacts = useStore((s) => s.contacts)
  const contact = useMemo(() => contacts.find((c) => c.id === contactId), [contacts, contactId])
  return (
    <Sheet open={!!contact} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {contact && <ContactDetail key={contact.id} contact={contact} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function ContactDetail({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const lookup = useLookup()
  const enrollments = useStore((s) => s.enrollments)
  const activities = useStore((s) => s.activities)
  const updateContact = useStore((s) => s.updateContact)
  const verifyEmails = useStore((s) => s.verifyEmails)
  const deleteContacts = useStore((s) => s.deleteContacts)

  const [form, setForm] = useState({ title: contact.title, email: contact.email, phone: contact.phone ?? "" })
  const [verifying, setVerifying] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const account = lookup.account(contact.accountId)
  const owner = lookup.user(contact.ownerId)
  const myEnrollments = useMemo(() => enrollments.filter((e) => e.contactId === contact.id), [enrollments, contact.id])
  const myActivity = useMemo(() => activities.filter((a) => a.contactId === contact.id), [activities, contact.id])
  const name = fullName(contact)

  const dirty = form.title !== contact.title || form.email !== contact.email || form.phone !== (contact.phone ?? "")

  const save = () => {
    const emailChanged = form.email.trim() !== contact.email
    updateContact(contact.id, {
      title: form.title.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      ...(emailChanged ? { emailStatus: form.email.trim() ? "unverified" : "missing" } : {}),
    })
    toast.success("Contact updated")
  }

  const verify = async () => {
    setVerifying(true)
    try {
      await verifyEmails([contact.id])
      const updated = useStore.getState().contacts.find((c) => c.id === contact.id)
      if (updated) setForm((f) => ({ ...f, email: updated.email }))
      if (updated?.emailStatus === "verified") toast.success("Email verified", { description: updated.email })
      else toast.error("Email is invalid", { description: updated?.email })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex items-center gap-3">
          <PersonAvatar name={name} className="size-11" />
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg">{name}</SheetTitle>
            <SheetDescription className="truncate">
              {contact.title} · {contact.seniority} · {contact.department}
            </SheetDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <StatusBadge status={contact.status} />
          <StatusBadge status={contact.emailStatus} label={`Email ${contact.emailStatus}`} />
          {contact.location && <Badge variant="outline">{contact.location}</Badge>}
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={verify} disabled={verifying}>
            {verifying ? <Loader2Icon className="animate-spin" /> : <MailCheckIcon />}
            {contact.emailStatus === "missing" ? "Find email" : "Verify email"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEnrollOpen(true)}>
            <ListPlusIcon /> Enroll in sequence
          </Button>
          {contact.linkedinUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={contact.linkedinUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon /> LinkedIn
              </a>
            </Button>
          )}
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setConfirmOpen(true)}>
            <Trash2Icon /> Delete
          </Button>
        </div>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Details</h3>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="cs-title">Title</FieldLabel>
              <Input id="cs-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="cs-email">Email</FieldLabel>
                <Input id="cs-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-phone">Phone</FieldLabel>
                <Input id="cs-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={contact.status}
                onValueChange={(v) => {
                  updateContact(contact.id, { status: v as Contact["status"] })
                  toast.success(`Status set to ${humanize(v)}`)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {humanize(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <div className="flex justify-end gap-2">
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForm({ title: contact.title, email: contact.email, phone: contact.phone ?? "" })}
              >
                Reset
              </Button>
            )}
            <Button size="sm" disabled={!dirty} onClick={save}>
              <SaveIcon /> Save changes
            </Button>
          </div>
        </section>

        <Separator />

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Account</div>
            {account ? (
              <Link href={`/accounts/${account.id}`} className="flex items-center gap-2 text-sm font-medium hover:underline">
                <CompanyAvatar name={account.name} className="size-6 text-[10px]" />
                {account.name}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Owner</div>
            <OwnerLabel user={owner} />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Last contacted</div>
            <div className="text-sm">{timeAgo(contact.lastContactedAt)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Created</div>
            <div className="text-sm">{shortDate(contact.createdAt)}</div>
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Sequence enrollments</h3>
          {myEnrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enrolled in any sequence.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {myEnrollments.map((e) => {
                const seq = lookup.sequence(e.sequenceId)
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/outreach/${e.sequenceId}`} className="truncate text-sm font-medium hover:underline">
                        {seq?.name ?? "Deleted sequence"}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Step {Math.min(e.currentStep + 1, seq?.steps.length ?? e.currentStep + 1)} of {seq?.steps.length ?? "?"} · enrolled{" "}
                        {timeAgo(e.enrolledAt)}
                      </div>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Activity</h3>
          <ActivityTimeline items={myActivity} emptyText="No activity for this contact yet." />
        </section>
      </div>

      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} contactIds={[contact.id]} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${name}?`}
        description="This removes the contact and any sequence enrollments. This cannot be undone."
        confirmLabel="Delete contact"
        onConfirm={() => {
          deleteContacts([contact.id])
          toast.success(`Deleted ${name}`)
          onClose()
        }}
      />
    </>
  )
}
