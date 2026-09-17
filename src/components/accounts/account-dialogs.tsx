"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { COUNTRIES, DEAL_STAGES, FUNDING_STAGES, INDUSTRIES } from "@/lib/constants"
import { currency } from "@/lib/format"
import { useCreateAccount, useCreateDeal, useUpdateAccount, useUsers } from "@/lib/api"
import type { Account, DealStage, User } from "@/lib/types"

const UNASSIGNED = "__none__"

/** Active, non-viewer team members (valid account owners). */
export const sellersOf = (users: User[] | undefined) => (users ?? []).filter((u) => u.status === "active" && u.role !== "viewer")

function OwnerSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { data: users } = useUsers()
  return (
    <Select value={value ?? UNASSIGNED} onValueChange={(v) => onChange(v === UNASSIGNED ? null : v)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {sellersOf(users).map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SimpleSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------- Add account

export function AddAccountDialog({
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
        {open && <AddAccountForm onClose={() => onOpenChange(false)} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  )
}

function AddAccountForm({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const createAccount = useCreateAccount()
  const [form, setForm] = useState({
    name: "",
    domain: "",
    industry: INDUSTRIES[0],
    employees: "100",
    country: COUNTRIES[0],
    ownerId: null as string | null,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const valid = form.name.trim() && /\./.test(form.domain) && Number(form.employees) > 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || createAccount.isPending) return
    createAccount.mutate(
      {
        name: form.name.trim(),
        domain: form.domain.trim(),
        industry: form.industry,
        employees: Math.round(Number(form.employees)),
        country: form.country,
        ownerId: form.ownerId,
      },
      {
        onSuccess: ({ account, duplicateOf }) => {
          if (duplicateOf) {
            toast.warning(`${account.name} added — possible duplicate`, {
              description: `Same domain as “${duplicateOf.name}”. Review it in the Duplicates tab.`,
            })
          } else {
            toast.success(`${account.name} added`, { description: `Scored ${account.score} · Tier ${account.tier}` })
          }
          onCreated?.(account.id)
          onClose()
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Add account</DialogTitle>
        <DialogDescription>The account is scored against your ICP and checked for duplicates by domain.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="a-name">Company name</FieldLabel>
            <Input id="a-name" required placeholder="Acme Inc." value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="a-domain">Domain</FieldLabel>
            <Input id="a-domain" required placeholder="acme.com" value={form.domain} onChange={(e) => set("domain", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Industry</FieldLabel>
            <SimpleSelect value={form.industry} onChange={(v) => set("industry", v)} options={INDUSTRIES} />
          </Field>
          <Field>
            <FieldLabel htmlFor="a-emp">Employees</FieldLabel>
            <Input id="a-emp" type="number" min={1} value={form.employees} onChange={(e) => set("employees", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Country</FieldLabel>
            <SimpleSelect value={form.country} onChange={(v) => set("country", v)} options={COUNTRIES} />
          </Field>
          <Field>
            <FieldLabel>Owner (optional)</FieldLabel>
            <OwnerSelect value={form.ownerId} onChange={(v) => set("ownerId", v)} />
          </Field>
        </div>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || createAccount.isPending}>
          {createAccount.isPending && <Loader2Icon className="animate-spin" />}
          Add account
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------- Edit account

export function EditAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {open && <EditAccountForm account={account} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

const splitList = (s: string) =>
  Array.from(
    new Set(
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  )

function EditAccountForm({ account, onClose }: { account: Account; onClose: () => void }) {
  const updateAccount = useUpdateAccount()
  const [form, setForm] = useState({
    name: account.name,
    industry: account.industry,
    employees: String(account.employees),
    revenue: String(account.revenue),
    country: account.country,
    city: account.city,
    fundingStage: account.fundingStage,
    technologies: account.technologies.join(", "),
    tags: account.tags.join(", "),
    description: account.description,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const industries = INDUSTRIES.includes(account.industry) ? INDUSTRIES : [account.industry, ...INDUSTRIES]
  const countries = COUNTRIES.includes(account.country) ? COUNTRIES : [account.country, ...COUNTRIES]
  const fundings = FUNDING_STAGES.includes(account.fundingStage) ? FUNDING_STAGES : [account.fundingStage, ...FUNDING_STAGES]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (updateAccount.isPending) return
    updateAccount.mutate(
      {
        id: account.id,
        name: form.name.trim(),
        industry: form.industry,
        employees: Math.max(1, Math.round(Number(form.employees) || account.employees)),
        revenue: Math.max(0, Math.round(Number(form.revenue) || 0)),
        country: form.country,
        city: form.city.trim(),
        fundingStage: form.fundingStage,
        technologies: splitList(form.technologies),
        tags: splitList(form.tags),
        description: form.description.trim(),
      },
      {
        onSuccess: ({ rescore }) => {
          toast.success("Account updated", {
            description: rescore && rescore.before !== rescore.after ? `Score ${rescore.before} → ${rescore.after}` : "Score unchanged",
          })
          onClose()
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Edit account</DialogTitle>
        <DialogDescription>Changes are versioned and the account is re-scored.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="e-name">Name</FieldLabel>
            <Input id="e-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Industry</FieldLabel>
            <SimpleSelect value={form.industry} onChange={(v) => set("industry", v)} options={industries} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="e-emp">Employees</FieldLabel>
            <Input id="e-emp" type="number" min={1} value={form.employees} onChange={(e) => set("employees", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="e-rev">Revenue (USD)</FieldLabel>
            <Input id="e-rev" type="number" min={0} step={100000} value={form.revenue} onChange={(e) => set("revenue", e.target.value)} />
            <FieldDescription>{currency(Number(form.revenue) || 0)}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Funding stage</FieldLabel>
            <SimpleSelect value={form.fundingStage} onChange={(v) => set("fundingStage", v)} options={fundings} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Country</FieldLabel>
            <SimpleSelect value={form.country} onChange={(v) => set("country", v)} options={countries} />
          </Field>
          <Field>
            <FieldLabel htmlFor="e-city">City</FieldLabel>
            <Input id="e-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="e-tech">Technologies</FieldLabel>
          <Input id="e-tech" value={form.technologies} onChange={(e) => set("technologies", e.target.value)} />
          <FieldDescription>Comma-separated, e.g. Salesforce, Snowflake, AWS</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="e-tags">Tags</FieldLabel>
          <Input id="e-tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
          <FieldDescription>Comma-separated</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="e-desc">Description</FieldLabel>
          <Textarea id="e-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateAccount.isPending}>
          {updateAccount.isPending && <Loader2Icon className="animate-spin" />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------- Create deal

export function CreateDealDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <DealForm account={account} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function DealForm({ account, onClose }: { account: Account; onClose: () => void }) {
  const createDeal = useCreateDeal()
  const [form, setForm] = useState(() => ({
    name: `${account.name} – New business`,
    amount: String(Math.max(12, Math.round((account.employees * 40) / 1000)) * 1000),
    stage: "discovery" as DealStage,
    closeDate: format(new Date(Date.now() + 45 * 86_400_000), "yyyy-MM-dd"),
  }))
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const valid = form.name.trim() && Number(form.amount) > 0 && form.closeDate

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    if (createDeal.isPending) return
    // Owner defaults to the account owner (or you) server-side.
    createDeal.mutate(
      {
        name: form.name.trim(),
        accountId: account.id,
        amount: Math.round(Number(form.amount)),
        stage: form.stage,
        closeDate: new Date(`${form.closeDate}T12:00:00`).toISOString(),
      },
      {
        onSuccess: (d) => {
          toast.success("Deal created", { description: `${d.name} · ${currency(d.amount)}` })
          onClose()
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Create deal</DialogTitle>
        <DialogDescription>Open a new opportunity for {account.name}.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="d-name">Deal name</FieldLabel>
          <Input id="d-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="d-amount">Amount (USD)</FieldLabel>
            <Input id="d-amount" type="number" min={1} step={1000} value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Stage</FieldLabel>
            <Select value={form.stage} onValueChange={(v) => set("stage", v as DealStage)}>
              <SelectTrigger className="w-full">
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
        </div>
        <Field>
          <FieldLabel htmlFor="d-close">Expected close date</FieldLabel>
          <Input id="d-close" type="date" required value={form.closeDate} onChange={(e) => set("closeDate", e.target.value)} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || createDeal.isPending}>
          {createDeal.isPending && <Loader2Icon className="animate-spin" />}
          Create deal
        </Button>
      </DialogFooter>
    </form>
  )
}

export { OwnerSelect }
