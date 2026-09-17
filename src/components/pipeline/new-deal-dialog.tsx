"use client"

import { useMemo, useState } from "react"
import { addDays } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DEAL_STAGES } from "@/lib/constants"
import { fullName } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { DealStage } from "@/lib/types"
import { AccountCombobox } from "./account-combobox"
import { fromDateInput, toDateInput } from "./deal-utils"

const NONE = "__none"
const autoName = (account?: string) => (account ? `${account} – New deal` : "")

export function NewDealDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <NewDealForm onDone={() => onOpenChange(false)} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  )
}

function NewDealForm({ onDone, onCreated }: { onDone: () => void; onCreated?: (id: string) => void }) {
  const accounts = useStore((s) => s.accounts)
  const contacts = useStore((s) => s.contacts)
  const users = useStore((s) => s.users)
  const currentUserId = useStore((s) => s.currentUserId)
  const addDeal = useStore((s) => s.addDeal)

  const [form, setForm] = useState({
    accountId: "",
    name: "",
    amount: "25000",
    stage: "discovery" as DealStage,
    closeDate: toDateInput(addDays(new Date(), 30).toISOString()),
    ownerId: currentUserId,
    contactId: NONE,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const sellers = useMemo(() => users.filter((u) => u.role !== "viewer"), [users])
  const accountContacts = useMemo(
    () => (form.accountId ? contacts.filter((c) => c.accountId === form.accountId) : []),
    [contacts, form.accountId],
  )

  const selectAccount = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId)
    setForm((f) => {
      const prev = accounts.find((a) => a.id === f.accountId)
      const keepName = f.name.trim() && f.name !== autoName(prev?.name)
      return {
        ...f,
        accountId,
        name: keepName ? f.name : autoName(account?.name),
        ownerId: account?.ownerId && sellers.some((u) => u.id === account.ownerId) ? account.ownerId : f.ownerId,
        contactId: contacts.find((c) => c.accountId === accountId)?.id ?? NONE,
      }
    })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!form.accountId) return toast.error("Select an account")
    if (!form.name.trim()) return toast.error("Deal name is required")
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount")
    if (!form.closeDate) return toast.error("Close date is required")
    const id = addDeal({
      name: form.name.trim(),
      accountId: form.accountId,
      amount,
      stage: form.stage,
      closeDate: fromDateInput(form.closeDate),
      ownerId: form.ownerId,
      contactId: form.contactId === NONE ? undefined : form.contactId,
      source: "Manual",
    })
    toast.success("Deal created", {
      description: form.name.trim(),
      action: onCreated ? { label: "Open", onClick: () => onCreated(id) } : undefined,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>New deal</DialogTitle>
        <DialogDescription>Create an opportunity and add it to the pipeline.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="nd-account">Account</FieldLabel>
          <AccountCombobox id="nd-account" value={form.accountId} onChange={selectAccount} />
        </Field>
        <Field>
          <FieldLabel htmlFor="nd-name">Deal name</FieldLabel>
          <Input id="nd-name" value={form.name} placeholder="Acme – New deal" onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="nd-amount">Amount (USD)</FieldLabel>
            <Input id="nd-amount" type="number" min={0} step={1000} value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="nd-stage">Stage</FieldLabel>
            <Select value={form.stage} onValueChange={(v) => set("stage", v as DealStage)}>
              <SelectTrigger id="nd-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label} · {s.probability}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="nd-close">Close date</FieldLabel>
            <Input id="nd-close" type="date" value={form.closeDate} onChange={(e) => set("closeDate", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="nd-owner">Owner</FieldLabel>
            <Select value={form.ownerId} onValueChange={(v) => set("ownerId", v)}>
              <SelectTrigger id="nd-owner" className="w-full">
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
        </div>
        <Field>
          <FieldLabel htmlFor="nd-contact">Primary contact</FieldLabel>
          <Select value={form.contactId} onValueChange={(v) => set("contactId", v)} disabled={!form.accountId}>
            <SelectTrigger id="nd-contact" className="w-full">
              <SelectValue placeholder={form.accountId ? "Select contact" : "Select an account first"} />
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
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Create deal</Button>
      </DialogFooter>
    </form>
  )
}
