"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRightIcon, BotIcon, CloudIcon, Loader2Icon, SaveIcon, StickyNoteIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { CompanyAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { QueryError } from "@/components/shared/query-state"
import { StatusBadge } from "@/components/shared/status"
import {
  canWrite,
  type DealRecord,
  useAccountContacts,
  useCurrentUser,
  useDeal,
  useDealActivities,
  useDeleteDeal,
  useLogActivity,
  useMoveDeal,
  useUpdateDeal,
} from "@/lib/api"
import { DEAL_STAGE_LABEL, DEAL_STAGES } from "@/lib/constants"
import { currency, dateTime, fullName, timeAgo } from "@/lib/format"
import type { DealStage } from "@/lib/types"
import { fromDateInput, isAgentSourced, toDateInput } from "./deal-utils"
import { useCrmName, useTeam } from "./hooks"

export function DealSheet({ dealId, onClose }: { dealId: string | null; onClose: () => void }) {
  const { data: deal, error, isError, refetch } = useDeal(dealId)
  return (
    <Sheet open={!!dealId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {deal && deal.id === dealId ? (
          <DealSheetBody key={deal.id} deal={deal} onClose={onClose} />
        ) : isError ? (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>Deal</SheetTitle>
              <SheetDescription className="sr-only">Deal details</SheetDescription>
            </SheetHeader>
            <div className="p-4">
              <QueryError error={error} title="Couldn't load this deal" onRetry={() => refetch()} />
            </div>
          </>
        ) : (
          <DealSheetSkeleton />
        )}
      </SheetContent>
    </Sheet>
  )
}

function DealSheetSkeleton() {
  return (
    <>
      <SheetHeader className="border-b">
        <Skeleton className="h-5 w-32" />
        <SheetTitle className="sr-only">Loading deal</SheetTitle>
        <Skeleton className="h-6 w-2/3" />
        <SheetDescription asChild>
          <Skeleton className="h-4 w-1/2" />
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 p-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    </>
  )
}

const NONE = "__none"

function DealSheetBody({ deal, onClose }: { deal: DealRecord; onClose: () => void }) {
  const user = useCurrentUser()
  const writable = canWrite(user.role)
  const updateDeal = useUpdateDeal()
  const moveDeal = useMoveDeal()
  const deleteDeal = useDeleteDeal()
  const logActivity = useLogActivity()
  const { sellers, byId } = useTeam()
  const crmName = useCrmName()
  const { data: accountContacts = [] } = useAccountContacts(deal.accountId)
  const { data: activityPage, isPending: activityLoading } = useDealActivities(deal.id)
  const dealActivity = activityPage?.data ?? []
  const { account } = deal

  const [form, setForm] = useState({
    name: deal.name,
    amount: String(deal.amount),
    probability: String(deal.probability),
    closeDate: toDateInput(deal.closeDate),
    ownerId: deal.ownerId,
    contactId: deal.contactId ?? NONE,
    notes: deal.notes,
  })
  const [note, setNote] = useState("")
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const dirty =
    form.name !== deal.name ||
    Number(form.amount) !== deal.amount ||
    Number(form.probability) !== deal.probability ||
    form.closeDate !== toDateInput(deal.closeDate) ||
    form.ownerId !== deal.ownerId ||
    form.contactId !== (deal.contactId ?? NONE) ||
    form.notes !== deal.notes

  const changeStage = (stage: DealStage) => {
    if (stage === deal.stage) return
    moveDeal.mutate(
      { id: deal.id, stage },
      {
        onSuccess: (updated) => {
          // The API adjusts probability (and close date for closed stages) — reflect it in the form.
          setForm((f) => ({ ...f, probability: String(updated.probability), closeDate: toDateInput(updated.closeDate) }))
          toast.success(`Moved to ${DEAL_STAGE_LABEL[stage]}`)
        },
      },
    )
  }

  const save = () => {
    const amount = Number(form.amount)
    const probability = Number(form.probability)
    if (!form.name.trim()) return toast.error("Deal name is required")
    if (!Number.isFinite(amount) || amount < 0) return toast.error("Enter a valid amount")
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) return toast.error("Probability must be 0–100")
    if (!form.closeDate) return toast.error("Close date is required")
    updateDeal.mutate(
      {
        id: deal.id,
        name: form.name.trim(),
        amount,
        probability,
        closeDate: fromDateInput(form.closeDate),
        ownerId: form.ownerId,
        contactId: form.contactId === NONE ? null : form.contactId,
        notes: form.notes,
      },
      { onSuccess: () => toast.success("Deal saved", { description: "Marked for next CRM sync" }) },
    )
  }

  const logNote = () => {
    const text = note.trim()
    if (!text || logActivity.isPending) return
    logActivity.mutate(
      {
        type: "note",
        dealId: deal.id,
        accountId: deal.accountId,
        title: text.slice(0, 80),
        detail: text.length > 80 ? text : undefined,
      },
      { onSuccess: () => setNote("") },
    )
  }

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <StatusBadge
            status={deal.stage}
            label={DEAL_STAGE_LABEL[deal.stage]}
            tone={deal.stage.startsWith("closed") ? undefined : "info"}
          />
          {isAgentSourced(deal.source) ? (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              <BotIcon /> {deal.source}
            </Badge>
          ) : (
            <Badge variant="outline">{deal.source}</Badge>
          )}
        </div>
        <SheetTitle className="text-lg">{deal.name}</SheetTitle>
        <SheetDescription>
          {currency(deal.amount, false)} · {deal.probability}% · created {timeAgo(deal.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {account && (
          <Link href={`/accounts/${account.id}`} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/60">
            <CompanyAvatar name={account.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{account.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {account.domain} · {account.industry} · Tier {account.tier}
              </div>
            </div>
            <ArrowUpRightIcon className="size-4 text-muted-foreground" />
          </Link>
        )}

        <fieldset disabled={!writable} className="contents">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="deal-name">Name</FieldLabel>
              <Input id="deal-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="deal-amount">Amount (USD)</FieldLabel>
                <Input
                  id="deal-amount"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="deal-stage">Stage</FieldLabel>
                <Select
                  value={deal.stage}
                  onValueChange={(v) => changeStage(v as DealStage)}
                  disabled={!writable || moveDeal.isPending}
                >
                  <SelectTrigger id="deal-stage" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEAL_STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="deal-prob">Probability (%)</FieldLabel>
                <Input
                  id="deal-prob"
                  type="number"
                  min={0}
                  max={100}
                  value={form.probability}
                  onChange={(e) => set("probability", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="deal-close">Close date</FieldLabel>
                <Input id="deal-close" type="date" value={form.closeDate} onChange={(e) => set("closeDate", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="deal-owner">Owner</FieldLabel>
                <Select value={form.ownerId} onValueChange={(v) => set("ownerId", v)} disabled={!writable}>
                  <SelectTrigger id="deal-owner" className="w-full">
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="deal-contact">Primary contact</FieldLabel>
                <Select value={form.contactId} onValueChange={(v) => set("contactId", v)} disabled={!writable}>
                  <SelectTrigger id="deal-contact" className="w-full">
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No contact</SelectItem>
                    {accountContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {fullName(c)} · {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="deal-notes">Notes</FieldLabel>
              <Textarea
                id="deal-notes"
                rows={3}
                value={form.notes}
                placeholder="Deal context, next steps, risks…"
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </FieldGroup>
        </fieldset>

        <Separator />

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <CloudIcon className="size-4 text-muted-foreground" /> CRM ({crmName})
          </h3>
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Record ID</div>
              <div className="font-mono">{deal.crmId ?? "Not created"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Last synced</div>
              {deal.syncedAt ? (
                <div>{dateTime(deal.syncedAt)}</div>
              ) : (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <span className="size-1.5 rounded-full bg-amber-500" /> Pending sync
                </div>
              )}
            </div>
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <StickyNoteIcon className="size-4 text-muted-foreground" /> Activity
          </h3>
          {writable && (
            <div className="space-y-2">
              <Textarea
                rows={2}
                value={note}
                placeholder="Log a note on this deal…"
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) logNote()
                }}
              />
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" onClick={logNote} disabled={!note.trim() || logActivity.isPending}>
                  {logActivity.isPending && <Loader2Icon className="animate-spin" />}
                  Log note
                </Button>
              </div>
            </div>
          )}
          {activityLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : dealActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="space-y-3 border-l pl-4">
              {dealActivity.map((a) => {
                const actor =
                  a.actorId === "agent"
                    ? "Agent"
                    : a.actorId === "system"
                      ? "System"
                      : ((a.actorId && byId.get(a.actorId)?.name) ?? "—")
                return (
                  <li key={a.id} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-muted-foreground/40 ring-4 ring-popover" />
                    <div className="text-sm">{a.title}</div>
                    {a.detail && <div className="line-clamp-2 text-xs text-muted-foreground">{a.detail}</div>}
                    <div className="text-xs text-muted-foreground">
                      {actor} · {timeAgo(a.at)}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>

      <SheetFooter className="flex-row items-center border-t">
        {writable && (
          <ConfirmDialog
            title="Delete this deal?"
            description={`“${deal.name}” will be removed from the pipeline. This cannot be undone.`}
            confirmLabel="Delete deal"
            onConfirm={() => {
              // Close first so the sheet doesn't try to show the (now deleted) deal; the mutation
              // lives on in the cache and toasts on success / error.
              onClose()
              deleteDeal.mutate(deal.id)
            }}
            trigger={
              <Button variant="destructive" disabled={deleteDeal.isPending}>
                <Trash2Icon /> Delete
              </Button>
            }
          />
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {writable && (
            <Button onClick={save} disabled={!dirty || updateDeal.isPending}>
              {updateDeal.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save
            </Button>
          )}
        </div>
      </SheetFooter>
    </>
  )
}
