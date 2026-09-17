"use client"

import { useMemo, useState } from "react"
import { ChevronsUpDownIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CompanyAvatar } from "@/components/shared/avatars"
import { useStore } from "@/lib/store"
import type { Seniority } from "@/lib/types"
import { DEPARTMENTS, SENIORITIES } from "./options"

export function AccountPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const accounts = useStore((s) => s.accounts)
  const [open, setOpen] = useState(false)
  const sorted = useMemo(
    () => accounts.filter((a) => !a.duplicateOf).sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  )
  const selected = accounts.find((a) => a.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <CompanyAvatar name={selected.name} className="size-5 text-[9px]" />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select account…</span>
          )}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search accounts…" />
          <CommandList>
            <CommandEmpty>No accounts found.</CommandEmpty>
            {sorted.map((a) => (
              <CommandItem
                key={a.id}
                value={`${a.name} ${a.domain} ${a.id}`}
                data-checked={a.id === value}
                onSelect={() => {
                  onChange(a.id)
                  setOpen(false)
                }}
              >
                <CompanyAvatar name={a.name} className="size-5 text-[9px]" />
                <span className="truncate">{a.name}</span>
                <span className="truncate text-xs text-muted-foreground">{a.domain}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function AddContactDialog({
  open,
  onOpenChange,
  accountId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the contact is created on this account and the picker is hidden. */
  accountId?: string
  onCreated?: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <ContactForm fixedAccountId={accountId} onClose={() => onOpenChange(false)} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  )
}

function ContactForm({
  fixedAccountId,
  onClose,
  onCreated,
}: {
  fixedAccountId?: string
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const addContact = useStore((s) => s.addContact)
  const accounts = useStore((s) => s.accounts)
  const [form, setForm] = useState({
    accountId: fixedAccountId ?? "",
    firstName: "",
    lastName: "",
    title: "",
    seniority: "Manager" as Seniority,
    department: "Sales",
    email: "",
    phone: "",
    linkedinUrl: "",
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const valid = form.accountId && form.firstName.trim() && form.lastName.trim() && form.title.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const account = accounts.find((a) => a.id === form.accountId)
    const id = addContact({
      accountId: form.accountId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      title: form.title.trim(),
      seniority: form.seniority,
      department: form.department,
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      linkedinUrl: form.linkedinUrl.trim(),
      location: account ? [account.city, account.country].filter(Boolean).join(", ") : "",
      ownerId: account?.ownerId ?? null,
    })
    toast.success(`Added ${form.firstName} ${form.lastName}`, { description: account?.name })
    onCreated?.(id)
    onClose()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Add contact</DialogTitle>
        <DialogDescription>Create a person record. Missing emails can be found later with “Verify / find emails”.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-4">
        {!fixedAccountId && (
          <Field>
            <FieldLabel>Account</FieldLabel>
            <AccountPicker value={form.accountId} onChange={(v) => set("accountId", v)} />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="c-first">First name</FieldLabel>
            <Input id="c-first" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-last">Last name</FieldLabel>
            <Input id="c-last" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="c-title">Title</FieldLabel>
          <Input id="c-title" required placeholder="VP Sales" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Seniority</FieldLabel>
            <Select value={form.seniority} onValueChange={(v) => set("seniority", v as Seniority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENIORITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Department</FieldLabel>
            <Select value={form.department} onValueChange={(v) => set("department", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="c-email">Email</FieldLabel>
            <Input id="c-email" type="email" placeholder="name@company.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-phone">Phone</FieldLabel>
            <Input id="c-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="c-li">LinkedIn URL</FieldLabel>
          <Input
            id="c-li"
            placeholder="https://linkedin.com/in/…"
            value={form.linkedinUrl}
            onChange={(e) => set("linkedinUrl", e.target.value)}
          />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Add contact
        </Button>
      </DialogFooter>
    </form>
  )
}
