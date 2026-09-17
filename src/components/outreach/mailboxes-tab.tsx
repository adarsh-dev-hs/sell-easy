"use client"

import { useMemo, useState } from "react"
import {
  CircleCheckIcon,
  MailIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status"
import { useStore } from "@/lib/store"
import type { Mailbox } from "@/lib/types"
import { cn } from "@/lib/utils"

const PROVIDERS: Mailbox["provider"][] = ["SES", "Google", "Microsoft", "Mailpool"]

const healthIndicator = (score: number) =>
  score >= 90
    ? "*:data-[slot=progress-indicator]:bg-emerald-500"
    : score >= 80
      ? "*:data-[slot=progress-indicator]:bg-sky-500"
      : score >= 65
        ? "*:data-[slot=progress-indicator]:bg-amber-500"
        : "*:data-[slot=progress-indicator]:bg-rose-500"

const healthText = (score: number) =>
  score >= 90
    ? "text-emerald-600 dark:text-emerald-400"
    : score >= 80
      ? "text-sky-600 dark:text-sky-400"
      : score >= 65
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400"

const AUTH_CHECKS = [
  { label: "SPF record", detail: "v=spf1 include:amazonses.com include:_spf.google.com ~all" },
  { label: "DKIM signing", detail: "2048-bit keys published for all sending domains" },
  { label: "DMARC policy", detail: "p=quarantine; rua reports enabled" },
  { label: "Custom tracking domain", detail: "track.acmegrowth.com (CNAME verified)" },
  { label: "Secondary sending domains", detail: "Cold outreach isolated from your primary domain" },
]

function ConnectMailboxDialog() {
  const addMailbox = useStore((s) => s.addMailbox)
  const mailboxes = useStore((s) => s.mailboxes)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [provider, setProvider] = useState<Mailbox["provider"]>("Google")
  const [limit, setLimit] = useState("40")

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const duplicate = mailboxes.some((m) => m.email.toLowerCase() === email.trim().toLowerCase())

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || duplicate) return
    addMailbox({ email: email.trim(), provider, dailyLimit: Math.max(1, Number(limit) || 40) })
    toast.success("Mailbox connected", { description: `${email.trim()} is warming up` })
    setOpen(false)
    setEmail("")
    setProvider("Google")
    setLimit("40")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> Connect mailbox
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Connect mailbox</DialogTitle>
            <DialogDescription>New mailboxes start with warm-up enabled and a conservative health score.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={email.length > 0 && (!valid || duplicate)}>
              <FieldLabel htmlFor="mb-email">Email address</FieldLabel>
              <Input
                id="mb-email"
                type="email"
                autoFocus
                placeholder="alex@try-yourdomain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {duplicate && <FieldDescription className="text-destructive">This mailbox is already connected.</FieldDescription>}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mb-provider">Provider</FieldLabel>
                <Select value={provider} onValueChange={(v) => setProvider(v as Mailbox["provider"])}>
                  <SelectTrigger id="mb-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="mb-limit">Daily limit</FieldLabel>
                <Input id="mb-limit" type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
            </div>
            <FieldDescription>We recommend ≤ 50 emails/day per mailbox for cold outreach.</FieldDescription>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || duplicate}>
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MailboxCard({ mailbox: m, onRemove }: { mailbox: Mailbox; onRemove: () => void }) {
  const updateMailbox = useStore((s) => s.updateMailbox)
  const sequences = useStore((s) => s.sequences)
  const usedBy = useMemo(() => sequences.filter((q) => q.mailboxIds.includes(m.id)).length, [sequences, m.id])
  const usage = m.dailyLimit > 0 ? Math.min(100, (m.sentToday / m.dailyLimit) * 100) : 0

  const commitLimit = (raw: string) => {
    const n = Math.round(Number(raw))
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Daily limit must be at least 1")
      return false
    }
    if (n === m.dailyLimit) return true
    updateMailbox(m.id, { dailyLimit: n })
    toast.success("Daily limit updated", { description: `${m.email} → ${n}/day` })
    return true
  }

  const togglePause = () => {
    const paused = m.status !== "paused"
    updateMailbox(m.id, { status: paused ? "paused" : "healthy" })
    toast.success(paused ? "Mailbox paused" : "Mailbox resumed", { description: m.email })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <MailIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{m.email}</span>
        </CardTitle>
        <CardDescription>
          {m.provider} · used by {usedBy} sequence{usedBy === 1 ? "" : "s"}
        </CardDescription>
        <CardAction>
          <StatusBadge status={m.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Health score</span>
            <span className={cn("font-semibold tabular-nums", healthText(m.healthScore))}>{m.healthScore}/100</span>
          </div>
          <Progress value={m.healthScore} className={cn("h-2", healthIndicator(m.healthScore))} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sent today</span>
            <span className="tabular-nums">
              {m.sentToday} / {m.dailyLimit}
            </span>
          </div>
          <Progress value={usage} className={cn("h-2", usage >= 90 && "*:data-[slot=progress-indicator]:bg-amber-500")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Label className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 font-normal">
            Warm-up
            <Switch
              checked={m.warmupEnabled}
              onCheckedChange={(v) => {
                updateMailbox(m.id, { warmupEnabled: v })
                toast.success(v ? "Warm-up enabled" : "Warm-up disabled", { description: m.email })
              }}
            />
          </Label>
          <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5">
            <Label htmlFor={`limit-${m.id}`} className="font-normal">
              Limit
            </Label>
            <Input
              key={m.dailyLimit}
              id={`limit-${m.id}`}
              type="number"
              min={1}
              defaultValue={m.dailyLimit}
              className="h-7 w-20 text-right"
              onBlur={(e) => {
                if (!commitLimit(e.target.value)) e.target.value = String(m.dailyLimit)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
              }}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={togglePause}>
          {m.status === "paused" ? <PlayIcon /> : <PauseIcon />}
          {m.status === "paused" ? "Resume" : "Pause"}
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2Icon /> Remove
        </Button>
      </CardFooter>
    </Card>
  )
}

export function MailboxesTab() {
  const mailboxes = useStore((s) => s.mailboxes)
  const removeMailbox = useStore((s) => s.removeMailbox)
  const [toRemove, setToRemove] = useState<Mailbox | null>(null)

  const summary = useMemo(() => {
    const active = mailboxes.filter((m) => m.status !== "paused")
    return {
      capacity: active.reduce((s, m) => s + m.dailyLimit, 0),
      sent: mailboxes.reduce((s, m) => s + m.sentToday, 0),
      avgHealth: mailboxes.length ? Math.round(mailboxes.reduce((s, m) => s + m.healthScore, 0) / mailboxes.length) : 0,
      warming: mailboxes.filter((m) => m.warmupEnabled).length,
      unhealthy: mailboxes.filter((m) => m.healthScore < 80),
      noWarmup: mailboxes.filter((m) => !m.warmupEnabled && m.status !== "paused"),
      nearLimit: mailboxes.filter((m) => m.status !== "paused" && m.dailyLimit > 0 && m.sentToday / m.dailyLimit >= 0.85),
      highLimit: mailboxes.filter((m) => m.dailyLimit > 100 && m.provider !== "SES"),
    }
  }, [mailboxes])

  const alerts = summary.unhealthy.length + summary.noWarmup.length + summary.nearLimit.length + summary.highLimit.length

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mailboxes" value={mailboxes.length} icon={MailIcon} hint={`${summary.warming} warming up`} />
        <StatCard label="Sent today" value={summary.sent} hint={`of ${summary.capacity} daily capacity`} />
        <StatCard label="Avg. health" value={`${summary.avgHealth}/100`} icon={ShieldCheckIcon} />
        <StatCard label="Alerts" value={alerts} icon={TriangleAlertIcon} hint={alerts ? "needs attention" : "all clear"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Connected mailboxes</h2>
            <ConnectMailboxDialog />
          </div>
          {mailboxes.length === 0 ? (
            <EmptyState icon={MailIcon} title="No mailboxes" description="Connect a mailbox to start sending sequences." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {mailboxes.map((m) => (
                <MailboxCard key={m.id} mailbox={m} onRemove={() => setToRemove(m)} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deliverability alerts</CardTitle>
              <CardDescription>Live checks across your sending infrastructure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts === 0 && (
                <Alert>
                  <CircleCheckIcon />
                  <AlertTitle>All mailboxes look healthy</AlertTitle>
                  <AlertDescription>No action needed right now.</AlertDescription>
                </Alert>
              )}
              {summary.unhealthy.map((m) => (
                <Alert key={`h-${m.id}`} variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>Low health: {m.email}</AlertTitle>
                  <AlertDescription>
                    Health score is {m.healthScore}. {m.warmupEnabled ? "Keep warm-up on" : "Enable warm-up"} and reduce volume until it
                    recovers above 80.
                  </AlertDescription>
                </Alert>
              ))}
              {summary.noWarmup.map((m) => (
                <Alert key={`w-${m.id}`}>
                  <TriangleAlertIcon />
                  <AlertTitle>Warm-up off: {m.email}</AlertTitle>
                  <AlertDescription>Sending without warm-up increases the risk of landing in spam.</AlertDescription>
                </Alert>
              ))}
              {summary.nearLimit.map((m) => (
                <Alert key={`l-${m.id}`}>
                  <TriangleAlertIcon />
                  <AlertTitle>Near daily limit: {m.email}</AlertTitle>
                  <AlertDescription>
                    {m.sentToday}/{m.dailyLimit} sent. Add mailboxes to the rotation to keep sequences on schedule.
                  </AlertDescription>
                </Alert>
              ))}
              {summary.highLimit.map((m) => (
                <Alert key={`x-${m.id}`}>
                  <TriangleAlertIcon />
                  <AlertTitle>High volume: {m.email}</AlertTitle>
                  <AlertDescription>{m.dailyLimit}/day is aggressive for a {m.provider} inbox. Consider ≤ 50.</AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Domain authentication</CardTitle>
              <CardDescription>Verified for all sending domains</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {AUTH_CHECKS.map((c) => (
                  <li key={c.label} className="flex gap-3">
                    <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{c.label}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground" title={c.detail}>
                        {c.detail}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best practices</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                <li>Keep bounce rate under 2% — verify emails before enrolling.</li>
                <li>Warm new mailboxes for 2–3 weeks before full volume.</li>
                <li>Rotate at least 2 mailboxes per active sequence.</li>
                <li>Avoid links and images in the first touch.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`Remove ${toRemove?.email ?? "mailbox"}?`}
        description="It will be disconnected and removed from every sequence's rotation."
        confirmLabel="Remove mailbox"
        onConfirm={() => {
          if (!toRemove) return
          removeMailbox(toRemove.id)
          toast.success("Mailbox removed", { description: toRemove.email })
          setToRemove(null)
        }}
      />
    </div>
  )
}
