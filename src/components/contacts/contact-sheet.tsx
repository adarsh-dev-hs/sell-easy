"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLinkIcon, ListPlusIcon, Loader2Icon, MailCheckIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { ActivityTimeline } from "@/components/accounts/activity-timeline"
import { CompanyAvatar, OwnerLabel, PersonAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { QueryError } from "@/components/shared/query-state"
import { humanize, StatusBadge } from "@/components/shared/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  canWrite,
  type ContactRecord,
  useContact,
  useContactActivities,
  useContactEnrollments,
  useCurrentUser,
  useDeleteContact,
  useUpdateContact,
  useUsers,
  useVerifyEmails,
} from "@/lib/api"
import { fullName, shortDate, timeAgo } from "@/lib/format"
import type { Contact } from "@/lib/types"
import { CONTACT_STATUSES } from "./options"
import { EnrollDialog } from "./enroll-dialog"

export function ContactSheet({ contactId, onOpenChange }: { contactId: string | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!contactId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {contactId && <ContactLoader key={contactId} contactId={contactId} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function ContactLoader({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const { data: contact, error, isLoading, refetch } = useContact(contactId)
  if (isLoading) {
    return (
      <>
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="sr-only">Loading contact</SheetTitle>
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </SheetHeader>
        <div className="space-y-3 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </>
    )
  }
  if (error || !contact) {
    return (
      <>
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Contact</SheetTitle>
        </SheetHeader>
        <div className="p-4">
          <QueryError error={error ?? new Error("Contact not found")} onRetry={() => refetch()} title="Couldn't load contact" />
        </div>
      </>
    )
  }
  return <ContactDetail contact={contact} onClose={onClose} />
}

type EditableField = "title" | "email" | "phone"

function ContactDetail({ contact, onClose }: { contact: ContactRecord; onClose: () => void }) {
  const me = useCurrentUser()
  const writable = canWrite(me.role)
  const { data: users } = useUsers()
  const { data: enrollments, isLoading: enrollmentsLoading } = useContactEnrollments(contact.id)
  const { data: activityPage, isLoading: activityLoading } = useContactActivities(contact.id)
  const updateContact = useUpdateContact()
  const verifyEmails = useVerifyEmails()
  const deleteContact = useDeleteContact()

  // Local edits layered over the server record (so server-side changes, e.g. a found email, show through).
  const [edits, setEdits] = useState<Partial<Record<EditableField, string>>>({})
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const base: Record<EditableField, string> = { title: contact.title, email: contact.email, phone: contact.phone ?? "" }
  const form: Record<EditableField, string> = {
    title: edits.title ?? base.title,
    email: edits.email ?? base.email,
    phone: edits.phone ?? base.phone,
  }
  const setField = (k: EditableField, v: string) => setEdits((e) => ({ ...e, [k]: v }))
  const dirty = (Object.keys(base) as EditableField[]).some((k) => form[k] !== base[k])

  const account = contact.account
  const owner = users?.find((u) => u.id === contact.ownerId)
  const name = fullName(contact)

  const save = () => {
    updateContact.mutate(
      { id: contact.id, title: form.title.trim(), email: form.email.trim(), phone: form.phone.trim() },
      {
        onSuccess: () => {
          setEdits({})
          toast.success("Contact updated")
        },
      },
    )
  }

  const verify = () => {
    verifyEmails.mutate([contact.id], {
      onSuccess: (r) => {
        setEdits((e) => ({ ...e, email: undefined }))
        if (r.verified) toast.success(r.found ? "Email found and verified" : "Email verified")
        else if (r.invalid) toast.error("Email is invalid")
        else toast.info("No verified email found")
      },
    })
  }

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex items-center gap-3">
          <PersonAvatar name={name} className="size-11" />
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg">{name}</SheetTitle>
            <SheetDescription className="truncate">
              {[contact.title, contact.seniority, contact.department].filter(Boolean).join(" · ")}
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
          {writable && (
            <>
              <Button variant="outline" size="sm" onClick={verify} disabled={verifyEmails.isPending}>
                {verifyEmails.isPending ? <Loader2Icon className="animate-spin" /> : <MailCheckIcon />}
                {contact.emailStatus === "missing" ? "Find email" : "Verify email"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEnrollOpen(true)}>
                <ListPlusIcon /> Enroll in sequence
              </Button>
            </>
          )}
          {contact.linkedinUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={contact.linkedinUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon /> LinkedIn
              </a>
            </Button>
          )}
          {writable && (
            <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setConfirmOpen(true)}>
              <Trash2Icon /> Delete
            </Button>
          )}
        </div>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Details</h3>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="cs-title">Title</FieldLabel>
              <Input id="cs-title" disabled={!writable} value={form.title} onChange={(e) => setField("title", e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="cs-email">Email</FieldLabel>
                <Input
                  id="cs-email"
                  type="email"
                  disabled={!writable}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-phone">Phone</FieldLabel>
                <Input id="cs-phone" disabled={!writable} value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={contact.status}
                disabled={!writable || updateContact.isPending}
                onValueChange={(v) =>
                  updateContact.mutate(
                    { id: contact.id, status: v as Contact["status"] },
                    { onSuccess: () => toast.success(`Status set to ${humanize(v)}`) },
                  )
                }
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
          {writable && (
            <div className="flex justify-end gap-2">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={() => setEdits({})}>
                  Reset
                </Button>
              )}
              <Button size="sm" disabled={!dirty || updateContact.isPending} onClick={save}>
                {updateContact.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save changes
              </Button>
            </div>
          )}
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
          {enrollmentsLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : !enrollments?.length ? (
            <p className="text-sm text-muted-foreground">Not enrolled in any sequence.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {enrollments.map((e) => {
                const seq = e.sequence
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/outreach/${e.sequenceId}`} className="truncate text-sm font-medium hover:underline">
                        {seq?.name ?? "Deleted sequence"}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Step {Math.min(e.currentStep + 1, seq?.stepCount ?? e.currentStep + 1)} of {seq?.stepCount ?? "?"} · enrolled{" "}
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
          {activityLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <ActivityTimeline items={activityPage?.data ?? []} emptyText="No activity for this contact yet." />
          )}
        </section>
      </div>

      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} target={{ kind: "contacts", contactIds: [contact.id] }} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${name}?`}
        description="This removes the contact and any sequence enrollments. This cannot be undone."
        confirmLabel="Delete contact"
        onConfirm={() => {
          deleteContact.mutate(contact.id)
          onClose()
        }}
      />
    </>
  )
}
