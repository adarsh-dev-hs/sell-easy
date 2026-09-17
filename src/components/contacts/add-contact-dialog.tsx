"use client"

import { useState } from "react"
import { ChevronsUpDownIcon, Loader2Icon } from "lucide-react"
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
import { useDebounced } from "@/components/accounts/use-debounced"
import { useAccounts, useCreateContact } from "@/lib/api"
import type { Seniority } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DEPARTMENTS, SENIORITIES } from "./options"

export interface AccountOption {
  id: string
  name: string
}

/**
 * Account combobox that searches accounts server-side.
 * When `allLabel` is set, an extra option clears the selection (used as a list filter).
 */
export function AccountPicker({
  value,
  onChange,
  allLabel,
  className,
  placeholder = "Select account…",
}: {
  value: AccountOption | null
  onChange: (account: AccountOption | null) => void
  allLabel?: string
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const q = useDebounced(search.trim())
  const { data, isFetching } = useAccounts({ q, pageSize: 20, sort: "name:asc" }, open)
  const rows = data?.data ?? []
  const pick = (a: AccountOption | null) => {
    onChange(a)
    setOpen(false)
    setSearch("")
  }
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", allLabel && value && "border-primary/40", className)}
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2">
              <CompanyAvatar name={value.name} className="size-5 text-[9px]" />
              <span className="truncate">{value.name}</span>
            </span>
          ) : (
            <span className={cn("truncate", !allLabel && "text-muted-foreground")}>{allLabel ?? placeholder}</span>
          )}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search accounts…" value={search} onValueChange={setSearch} />
          <CommandList>
            {!isFetching && <CommandEmpty>No accounts found.</CommandEmpty>}
            {allLabel && !q && (
              <CommandItem value="__all" data-checked={!value} onSelect={() => pick(null)}>
                {allLabel}
              </CommandItem>
            )}
            {rows.map((a) => (
              <CommandItem key={a.id} value={a.id} data-checked={a.id === value?.id} onSelect={() => pick({ id: a.id, name: a.name })}>
                <CompanyAvatar name={a.name} className="size-5 text-[9px]" />
                <span className="truncate">{a.name}</span>
                <span className="truncate text-xs text-muted-foreground">{a.domain}</span>
              </CommandItem>
            ))}
            {isFetching && rows.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Searching…
              </div>
            )}
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
  const createContact = useCreateContact()
  const [account, setAccount] = useState<AccountOption | null>(null)
  const [form, setForm] = useState({
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
  const accountId = fixedAccountId ?? account?.id ?? ""
  const valid = accountId && form.firstName.trim() && form.lastName.trim() && form.title.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || createContact.isPending) return
    // Location and owner are inherited from the account server-side.
    createContact.mutate(
      {
        accountId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        title: form.title.trim(),
        seniority: form.seniority,
        department: form.department,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        linkedinUrl: form.linkedinUrl.trim(),
      },
      {
        onSuccess: (c) => {
          onCreated?.(c.id)
          onClose()
        },
      },
    )
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
            <AccountPicker value={account} onChange={setAccount} />
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
        <Button type="submit" disabled={!valid || createContact.isPending}>
          {createContact.isPending && <Loader2Icon className="animate-spin" />}
          Add contact
        </Button>
      </DialogFooter>
    </form>
  )
}
