"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, LockIcon, LogOutIcon, RotateCcwIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCurrentUser, useStore } from "@/lib/store"
import type { Organization } from "@/lib/types"
import { cn } from "@/lib/utils"
import { canManageOrg } from "./shared"

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
]

export const PLANS: { id: Organization["plan"]; name: string; price: string; seats: number; features: string[] }[] = [
  { id: "starter", name: "Starter", price: "$99/mo", seats: 3, features: ["3 seats", "2,500 enrichment credits", "1 active sequence", "Email support"] },
  { id: "growth", name: "Growth", price: "$499/mo", seats: 10, features: ["10 seats", "25,000 enrichment credits", "Orchestration agent", "CRM write-back"] },
  { id: "enterprise", name: "Enterprise", price: "Custom", seats: 50, features: ["50 seats", "Unlimited credits", "SSO & audit log", "Dedicated CSM"] },
]

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i

export function OrganizationTab() {
  const org = useStore((s) => s.org)
  const user = useCurrentUser()
  const canEdit = canManageOrg(user?.role)
  return (
    <div className="space-y-6">
      {!canEdit && (
        <Alert>
          <LockIcon />
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>Only owners and admins can change organization settings.</AlertDescription>
        </Alert>
      )}
      <OrgForm key={`${org.name}|${org.domain}|${org.timezone}`} org={org} canEdit={canEdit} />
      <PlanCard canEdit={canEdit} />
      <DangerZone canEdit={canEdit} />
    </div>
  )
}

function OrgForm({ org, canEdit }: { org: Organization; canEdit: boolean }) {
  const updateOrg = useStore((s) => s.updateOrg)
  const [name, setName] = useState(org.name)
  const [domain, setDomain] = useState(org.domain)
  const [timezone, setTimezone] = useState(org.timezone)
  const [submitted, setSubmitted] = useState(false)

  const errors = {
    name: name.trim().length < 2 ? "Organization name is required." : null,
    domain: !DOMAIN_RE.test(domain.trim()) ? "Enter a valid domain, e.g. acme.com" : null,
  }
  const dirty = name !== org.name || domain !== org.domain || timezone !== org.timezone
  const zones = TIMEZONES.includes(org.timezone) ? TIMEZONES : [org.timezone, ...TIMEZONES]

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    setSubmitted(true)
    if (errors.name || errors.domain) return
    updateOrg({ name: name.trim(), domain: domain.trim().toLowerCase(), timezone })
    toast.success("Organization updated")
  }

  return (
    <Card>
      <form onSubmit={save} className="contents">
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Company details used for routing, scheduling and email signatures.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={submitted && !!errors.name} data-disabled={!canEdit}>
              <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
              <Input id="org-name" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && !!errors.name} />
              {submitted && errors.name && <FieldError>{errors.name}</FieldError>}
            </Field>
            <Field data-invalid={submitted && !!errors.domain} data-disabled={!canEdit}>
              <FieldLabel htmlFor="org-domain">Domain</FieldLabel>
              <Input id="org-domain" value={domain} disabled={!canEdit} onChange={(e) => setDomain(e.target.value)} aria-invalid={submitted && !!errors.domain} />
              {submitted && errors.domain ? (
                <FieldError>{errors.domain}</FieldError>
              ) : (
                <FieldDescription>Teammates with this email domain can request access.</FieldDescription>
              )}
            </Field>
            <Field data-disabled={!canEdit}>
              <FieldLabel htmlFor="org-tz">Timezone</FieldLabel>
              <Select value={timezone} onValueChange={setTimezone} disabled={!canEdit}>
                <SelectTrigger id="org-tz" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Sequence send windows use this timezone.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!canEdit || !dirty}
            onClick={() => {
              setName(org.name)
              setDomain(org.domain)
              setTimezone(org.timezone)
              setSubmitted(false)
            }}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!canEdit || !dirty}>
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function PlanCard({ canEdit }: { canEdit: boolean }) {
  const org = useStore((s) => s.org)
  const users = useStore((s) => s.users)
  const updateOrg = useStore((s) => s.updateOrg)
  const [open, setOpen] = useState(false)

  const active = users.filter((u) => u.status === "active").length
  const invited = users.filter((u) => u.status === "invited").length
  const used = active + invited
  const pct = org.seats > 0 ? Math.min(100, (used / org.seats) * 100) : 100
  const plan = PLANS.find((p) => p.id === org.plan) ?? PLANS[0]

  const choose = (id: Organization["plan"]) => {
    const target = PLANS.find((p) => p.id === id)!
    if (id === org.plan) {
      setOpen(false)
      return
    }
    if (target.seats < used) {
      toast.error(`${target.name} includes ${target.seats} seats`, {
        description: `You're using ${used}. Remove members before downgrading.`,
      })
      return
    }
    updateOrg({ plan: id, seats: target.seats })
    toast.success(`Switched to ${target.name}`, { description: `${target.seats} seats available.` })
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Plan <Badge>{plan.name}</Badge>
        </CardTitle>
        <CardDescription>
          {plan.price} · {plan.features.slice(1).join(" · ")}
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setOpen(true)} disabled={!canEdit}>
            <SparklesIcon /> {org.plan === "enterprise" ? "Change plan" : "Upgrade plan"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Seats</span>
          <span className="tabular-nums text-muted-foreground">
            {used} of {org.seats} used · {Math.max(0, org.seats - used)} available
          </span>
        </div>
        <Progress value={pct} className={cn("h-2", pct >= 100 && "[&>[data-slot=progress-indicator]]:bg-destructive")} />
        <p className="text-xs text-muted-foreground">
          {active} active · {invited} pending invite{invited === 1 ? "" : "s"}
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose a plan</DialogTitle>
            <DialogDescription>Changes apply immediately. You&apos;re currently using {used} seats.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANS.map((p) => {
              const current = p.id === org.plan
              const tooSmall = p.seats < used
              return (
                <div key={p.id} className={cn("flex flex-col gap-3 rounded-xl border p-4", current && "border-primary ring-1 ring-primary")}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.name}</span>
                    {current && <Badge variant="secondary">Current</Badge>}
                  </div>
                  <div className="text-2xl font-semibold tracking-tight">{p.price}</div>
                  <ul className="flex-1 space-y-1.5 text-sm text-muted-foreground">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckIcon className="size-3.5 text-primary" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button variant={current ? "outline" : "default"} disabled={current || tooSmall} onClick={() => choose(p.id)}>
                    {current ? "Current plan" : tooSmall ? "Too few seats" : `Select ${p.name}`}
                  </Button>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function DangerZone({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const resetDemo = useStore((s) => s.resetDemo)
  const logout = useStore((s) => s.logout)

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>These actions can&apos;t be undone.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Reset demo data</div>
            <p className="text-sm text-muted-foreground">Restore all accounts, signals, sequences and settings to the original seed.</p>
          </div>
          <ConfirmDialog
            title="Reset all demo data?"
            description="Every change you've made — accounts, deals, integrations, team and settings — will be replaced with fresh seed data."
            confirmLabel="Reset data"
            onConfirm={() => {
              resetDemo()
              toast.success("Demo data reset")
            }}
            trigger={
              <Button variant="destructive" disabled={!canEdit}>
                <RotateCcwIcon /> Reset demo data
              </Button>
            }
          />
        </div>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Log out</div>
            <p className="text-sm text-muted-foreground">End your session on this device.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              logout()
              toast.success("Logged out")
              router.replace("/login")
            }}
          >
            <LogOutIcon /> Log out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
