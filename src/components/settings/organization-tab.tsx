"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { CheckIcon, DatabaseIcon, Loader2Icon, LockIcon, LogOutIcon, RotateCcwIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { QueryError } from "@/components/shared/query-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  api,
  isAdmin,
  type OrgWithSeats,
  useAuthStore,
  useChangePlan,
  useCurrentUser,
  useMeta,
  useOrg,
  useResetWorkspace,
  useUpdateOrg,
  useUsers,
} from "@/lib/api"
import type { Organization } from "@/lib/types"
import { cn } from "@/lib/utils"

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

/** Marketing copy only — seat counts come from the API (`meta.planSeats`). */
const PLANS: { id: Organization["plan"]; name: string; price: string; features: string[] }[] = [
  { id: "starter", name: "Starter", price: "$99/mo", features: ["2,500 enrichment credits", "1 active sequence", "Email support"] },
  { id: "growth", name: "Growth", price: "$499/mo", features: ["25,000 enrichment credits", "Orchestration agent", "CRM write-back"] },
  { id: "enterprise", name: "Enterprise", price: "Custom", features: ["Unlimited credits", "SSO & audit log", "Dedicated CSM"] },
]

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i

export function OrganizationTab() {
  const orgQuery = useOrg()
  const user = useCurrentUser()
  const canEdit = isAdmin(user.role)
  const org = orgQuery.data
  if (orgQuery.isError) return <QueryError error={orgQuery.error} onRetry={() => orgQuery.refetch()} />
  if (!org) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    )
  }
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
      <PlanCard org={org} canChange={user.role === "owner"} />
      <DangerZone canReset={user.role === "owner"} />
    </div>
  )
}

function OrgForm({ org, canEdit }: { org: Organization; canEdit: boolean }) {
  const updateOrg = useUpdateOrg()
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
    updateOrg.mutate({ name: name.trim(), domain: domain.trim().toLowerCase(), timezone }, { onSuccess: () => setSubmitted(false) })
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
            disabled={!canEdit || !dirty || updateOrg.isPending}
            onClick={() => {
              setName(org.name)
              setDomain(org.domain)
              setTimezone(org.timezone)
              setSubmitted(false)
            }}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!canEdit || !dirty || updateOrg.isPending}>
            {updateOrg.isPending && <Loader2Icon className="animate-spin" />}
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function PlanCard({ org, canChange }: { org: OrgWithSeats; canChange: boolean }) {
  const users = useUsers()
  const meta = useMeta()
  const changePlan = useChangePlan()
  const [open, setOpen] = useState(false)

  const used = org.seatsUsed
  const active = users.data?.filter((u) => u.status === "active").length
  const invited = users.data?.filter((u) => u.status === "invited").length
  const pct = org.seats > 0 ? Math.min(100, (used / org.seats) * 100) : 100
  const plan = PLANS.find((p) => p.id === org.plan) ?? PLANS[0]
  const seatsFor = (id: Organization["plan"]) => meta.data?.planSeats[id] ?? (id === org.plan ? org.seats : undefined)

  const choose = (id: Organization["plan"]) => {
    if (id === org.plan) {
      setOpen(false)
      return
    }
    changePlan.mutate(id, { onSuccess: () => setOpen(false) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Plan <Badge>{plan.name}</Badge>
        </CardTitle>
        <CardDescription>
          {plan.price} · {plan.features.join(" · ")}
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            disabled={!canChange}
            title={canChange ? undefined : "Only the workspace owner can change the plan"}
          >
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
        {active !== undefined && invited !== undefined && (
          <p className="text-xs text-muted-foreground">
            {active} active · {invited} pending invite{invited === 1 ? "" : "s"}
          </p>
        )}
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
              const seats = seatsFor(p.id)
              const tooSmall = seats !== undefined && seats < used
              const pending = changePlan.isPending && changePlan.variables === p.id
              return (
                <div key={p.id} className={cn("flex flex-col gap-3 rounded-xl border p-4", current && "border-primary ring-1 ring-primary")}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.name}</span>
                    {current && <Badge variant="secondary">Current</Badge>}
                  </div>
                  <div className="text-2xl font-semibold tracking-tight">{p.price}</div>
                  <ul className="flex-1 space-y-1.5 text-sm text-muted-foreground">
                    {[seats !== undefined ? `${seats} seats` : "Seats loading…", ...p.features].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckIcon className="size-3.5 text-primary" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={current ? "outline" : "default"}
                    disabled={current || tooSmall || changePlan.isPending}
                    onClick={() => choose(p.id)}
                  >
                    {pending && <Loader2Icon className="animate-spin" />}
                    {current ? "Current plan" : tooSmall ? "Too few seats" : `Select ${p.name}`}
                  </Button>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={changePlan.isPending}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function DangerZone({ canReset }: { canReset: boolean }) {
  const router = useRouter()
  const qc = useQueryClient()
  const clearSession = useAuthStore((s) => s.clear)
  const meta = useMeta()
  const reset = useResetWorkspace()
  const [resetOpen, setResetOpen] = useState(false)
  const showReset = canReset && meta.data?.features.adminReset === true

  const logout = () => {
    void api.post("/auth/logout").catch(() => undefined)
    clearSession()
    qc.clear()
    toast.success("Logged out")
    router.replace("/login")
  }

  const runReset = (demo: boolean) => reset.mutate({ demo }, { onSuccess: () => setResetOpen(false) })

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>These actions can&apos;t be undone.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {showReset && (
          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">Reset workspace</div>
              <p className="text-sm text-muted-foreground">
                Wipe accounts, signals, sequences, deals and settings. Team members and API keys are kept.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setResetOpen(true)}>
              <RotateCcwIcon /> Reset workspace
            </Button>
          </div>
        )}
        <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", showReset && "pt-4")}>
          <div>
            <div className="font-medium">Log out</div>
            <p className="text-sm text-muted-foreground">End your session on this device.</p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOutIcon /> Log out
          </Button>
        </div>
      </CardContent>

      <Dialog open={resetOpen} onOpenChange={(o) => !reset.isPending && setResetOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset workspace?</DialogTitle>
            <DialogDescription>
              Every account, contact, signal, sequence, deal and integration setting in this workspace will be deleted. Team members and API
              keys are kept.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button variant="destructive" disabled={reset.isPending} onClick={() => runReset(false)}>
              {reset.isPending && reset.variables?.demo === false ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Clear all data
            </Button>
            <Button variant="outline" disabled={reset.isPending} onClick={() => runReset(true)}>
              {reset.isPending && reset.variables?.demo === true ? <Loader2Icon className="animate-spin" /> : <DatabaseIcon />}
              Load demo data
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={reset.isPending} onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
