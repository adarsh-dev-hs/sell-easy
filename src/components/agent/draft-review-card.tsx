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
import { canWrite, type DraftRecord, useApproveDraft, useCurrentUser, useRegenerateDraft, useRejectDraft } from "@/lib/api"
import { fullName, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

interface DraftReviewCardProps {
  draft: DraftRecord
  className?: string
  compact?: boolean
}

/** Review card for a pending draft. Local edits reset whenever the server copy changes (e.g. after regenerate). */
export function DraftReviewCard(props: DraftReviewCardProps) {
  return <DraftReviewCardInner key={`${props.draft.id}:${props.draft.updatedAt}`} {...props} />
}

function DraftReviewCardInner({ draft, className, compact }: DraftReviewCardProps) {
  const user = useCurrentUser()
  const writable = canWrite(user.role)
  const approveDraft = useApproveDraft()
  const rejectDraft = useRejectDraft()
  const regenerateDraft = useRegenerateDraft()
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)

  const { account, contact } = draft
  const edited = subject !== draft.subject || body !== draft.body
  const regenerating = regenerateDraft.isPending
  const busy = regenerating || approveDraft.isPending || rejectDraft.isPending

  const regenerate = () =>
    regenerateDraft.mutate(draft.id, {
      // The mutation invalidates the drafts query; the refreshed draft (new updatedAt) remounts this card.
      onSuccess: (fresh) => {
        setSubject(fresh.subject)
        setBody(fresh.body)
      },
    })

  const approve = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required")
      return
    }
    approveDraft.mutate(
      { id: draft.id, ...(edited ? { subject, body } : {}) },
      {
        onSuccess: (r) => {
          toast.success(`Sent to ${r.contact?.name ?? (contact ? fullName(contact) : "contact")}`, {
            description: r.enrollment
              ? `Enrolled in “${r.enrollment.sequence.name}”`
              : edited
                ? "Sent with your edits"
                : undefined,
          })
        },
      },
    )
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
            <Input
              id={`subj-${draft.id}`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy}
              readOnly={!writable}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`body-${draft.id}`}>Message</FieldLabel>
            <Textarea
              id={`body-${draft.id}`}
              rows={compact ? 6 : 8}
              className={cn("field-sizing-fixed resize-y", compact ? "min-h-36" : "min-h-48")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
              readOnly={!writable}
            />
          </Field>
        </FieldGroup>
      </CardContent>
      {writable && (
        <CardFooter className="flex flex-wrap justify-end gap-2">
          <ConfirmDialog
            title="Reject this draft?"
            description="The draft will be discarded and the agent run marked complete without sending."
            confirmLabel="Reject"
            onConfirm={() => rejectDraft.mutate(draft.id)}
            trigger={
              <Button variant="ghost" disabled={busy}>
                {rejectDraft.isPending ? <Loader2Icon className="animate-spin" /> : <XIcon />} Reject
              </Button>
            }
          />
          <Button variant="outline" onClick={regenerate} disabled={busy}>
            {regenerating ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
            Regenerate
          </Button>
          <Button onClick={approve} disabled={busy}>
            {approveDraft.isPending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Approve & send
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
