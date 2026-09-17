"use client"

import { useState } from "react"
import Link from "next/link"
import { BotIcon, CheckIcon, Loader2Icon, RefreshCwIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CompanyAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { TierBadge } from "@/components/shared/score"
import { fullName, timeAgo } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { OutreachDraft } from "@/lib/types"
import { cn } from "@/lib/utils"

export function DraftReviewCard({ draft, className, compact }: { draft: OutreachDraft; className?: string; compact?: boolean }) {
  const lookup = useLookup()
  const approveDraft = useStore((s) => s.approveDraft)
  const rejectDraft = useStore((s) => s.rejectDraft)
  const regenerateDraft = useStore((s) => s.regenerateDraft)
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [regenerating, setRegenerating] = useState(false)

  const account = lookup.account(draft.accountId)
  const contact = lookup.contact(draft.contactId)
  const sequence = lookup.sequence(draft.sequenceId)
  const edited = subject !== draft.subject || body !== draft.body

  const regenerate = async () => {
    setRegenerating(true)
    try {
      await regenerateDraft(draft.id)
      const fresh = useStore.getState().drafts.find((d) => d.id === draft.id)
      if (fresh) {
        setSubject(fresh.subject)
        setBody(fresh.body)
      }
      toast.success("Draft regenerated", { description: "Claude wrote a new variant." })
    } finally {
      setRegenerating(false)
    }
  }

  const approve = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required")
      return
    }
    approveDraft(draft.id, edited ? { subject, body } : undefined)
    toast.success(`Sent to ${contact ? fullName(contact) : "contact"}`, {
      description: sequence ? `Enrolled in “${sequence.name}”` : edited ? "Sent with your edits" : undefined,
    })
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          {account && <CompanyAvatar name={account.name} />}
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {account ? (
                <Link href={`/accounts/${account.id}`} className="truncate hover:underline">
                  {account.name}
                </Link>
              ) : (
                "Unknown account"
              )}
              {account && <TierBadge tier={account.tier} />}
            </CardTitle>
            <CardDescription className="truncate">
              {contact ? `${fullName(contact)} · ${contact.title}` : "Unknown contact"} · {timeAgo(draft.createdAt)}
            </CardDescription>
          </div>
        </div>
        <CardAction className="flex items-center gap-1.5">
          <Badge variant="outline" className="capitalize">
            {draft.channel === "linkedin" ? "LinkedIn" : "Email"}
          </Badge>
          {edited && <Badge variant="secondary">Edited</Badge>}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2.5 rounded-lg border bg-muted/50 p-3 text-sm">
          <BotIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-0.5">
            <div className="font-medium">Why this draft</div>
            <p className="text-muted-foreground">{draft.rationale}</p>
          </div>
        </div>
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor={`subj-${draft.id}`}>Subject</FieldLabel>
            <Input id={`subj-${draft.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={regenerating} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`body-${draft.id}`}>Message</FieldLabel>
            <Textarea
              id={`body-${draft.id}`}
              rows={compact ? 6 : 8}
              className={cn("field-sizing-fixed resize-y", compact ? "min-h-36" : "min-h-48")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={regenerating}
            />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        <ConfirmDialog
          title="Reject this draft?"
          description="The draft will be discarded and the agent run marked complete without sending."
          confirmLabel="Reject"
          onConfirm={() => {
            rejectDraft(draft.id)
            toast("Draft rejected")
          }}
          trigger={
            <Button variant="ghost" disabled={regenerating}>
              <XIcon /> Reject
            </Button>
          }
        />
        <Button variant="outline" onClick={regenerate} disabled={regenerating}>
          {regenerating ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
          Regenerate
        </Button>
        <Button onClick={approve} disabled={regenerating}>
          <CheckIcon /> Approve & send
        </Button>
      </CardFooter>
    </Card>
  )
}
