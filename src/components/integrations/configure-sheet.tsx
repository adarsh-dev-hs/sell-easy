"use client"

import { useMemo, useState } from "react"
import { CheckCircle2Icon, KeyRoundIcon, Loader2Icon, UnplugIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { INTEGRATION_CATEGORY_LABELS } from "@/lib/constants"
import { dateTime, timeAgo } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { Integration } from "@/lib/types"
import { CATEGORY_FIELDS, SYNC_INTERVALS, type ConfigField } from "./config"
import { IntegrationTile, UsageBar } from "./integration-card"

type Settings = Integration["settings"]

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

function buildSyncLog(i: Integration) {
  if (!i.lastSyncAt) return []
  const base = new Date(i.lastSyncAt).getTime()
  const step = SYNC_INTERVALS.find((x) => x.value === i.settings.syncInterval)?.ms ?? 3_600_000
  const noun = i.category === "llm" ? "requests" : i.category === "crm" ? "records" : i.category === "intent" ? "signals" : "records"
  return Array.from({ length: 5 }, (_, idx) => {
    const failed = idx === 0 && i.status === "error"
    const count = (hash(`${i.id}-${idx}`) % 180) + 12
    return {
      at: new Date(base - idx * step).toISOString(),
      ok: !failed,
      message: failed ? "401 Unauthorized — API key rejected" : `Synced ${count} ${noun}`,
      durationMs: 400 + (hash(`${i.id}:${idx}`) % 2600),
    }
  })
}

export function ConfigureSheet({ integration, onOpenChange }: { integration: Integration | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!integration} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {integration && <ConfigureBody key={integration.id} integration={integration} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function ConfigureBody({ integration: i, onClose }: { integration: Integration; onClose: () => void }) {
  const updateIntegrationSettings = useStore((s) => s.updateIntegrationSettings)
  const connectIntegration = useStore((s) => s.connectIntegration)
  const disconnectIntegration = useStore((s) => s.disconnectIntegration)

  const fields = CATEGORY_FIELDS[i.category]
  const [draft, setDraft] = useState<Settings>(() => {
    const init: Settings = {
      autoSync: i.settings.autoSync ?? true,
      syncInterval: i.settings.syncInterval ?? "hourly",
    }
    for (const f of fields) init[f.key] = i.settings[f.key] ?? f.default
    return init
  })
  const [rotating, setRotating] = useState(false)
  const [newKey, setNewKey] = useState("")
  const [rotateBusy, setRotateBusy] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const log = useMemo(() => buildSyncLog(i), [i])
  const set = (key: string, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }))

  const numberErrors = fields
    .filter((f): f is Extract<ConfigField, { type: "number" }> => f.type === "number")
    .reduce<Record<string, string>>((acc, f) => {
      const v = Number(draft[f.key])
      if (String(draft[f.key]).trim() === "" || !Number.isFinite(v) || v < (f.min ?? 0)) acc[f.key] = `Enter a number ≥ ${f.min ?? 0}.`
      return acc
    }, {})
  const dirty = Object.keys(draft).some((k) => draft[k] !== (i.settings[k] ?? fields.find((f) => f.key === k)?.default))
  const hasErrors = Object.keys(numberErrors).length > 0

  const save = () => {
    if (hasErrors) {
      toast.error("Fix the highlighted fields first")
      return
    }
    const clean: Settings = { ...draft }
    for (const f of fields) if (f.type === "number") clean[f.key] = String(Number(draft[f.key]))
    updateIntegrationSettings(i.id, clean)
    toast.success(`${i.name} settings saved`)
  }

  const rotate = async () => {
    if (newKey.trim().length < 8) {
      toast.error("API key must be at least 8 characters")
      return
    }
    setRotateBusy(true)
    try {
      await connectIntegration(i.id, newKey.trim())
      toast.success("API key rotated", { description: `${i.name} is using the new key.` })
      setRotating(false)
      setNewKey("")
    } finally {
      setRotateBusy(false)
    }
  }

  const renderField = (f: ConfigField) => {
    if (f.type === "switch") {
      return (
        <Field key={f.key} orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`cfg-${f.key}`}>{f.label}</FieldLabel>
            {f.description && <FieldDescription>{f.description}</FieldDescription>}
          </FieldContent>
          <Switch id={`cfg-${f.key}`} checked={draft[f.key] === true} onCheckedChange={(v) => set(f.key, v)} />
        </Field>
      )
    }
    if (f.type === "select") {
      return (
        <Field key={f.key}>
          <FieldLabel htmlFor={`cfg-${f.key}`}>{f.label}</FieldLabel>
          <Select value={String(draft[f.key])} onValueChange={(v) => set(f.key, v)}>
            <SelectTrigger id={`cfg-${f.key}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {f.description && <FieldDescription>{f.description}</FieldDescription>}
        </Field>
      )
    }
    const err = numberErrors[f.key]
    return (
      <Field key={f.key} data-invalid={!!err}>
        <FieldLabel htmlFor={`cfg-${f.key}`}>
          {f.label}
          {f.suffix && <span className="font-normal text-muted-foreground">({f.suffix})</span>}
        </FieldLabel>
        <Input
          id={`cfg-${f.key}`}
          type="number"
          inputMode="numeric"
          min={f.min}
          value={String(draft[f.key])}
          aria-invalid={!!err}
          onChange={(e) => set(f.key, e.target.value)}
        />
        {err ? <FieldError>{err}</FieldError> : f.description && <FieldDescription>{f.description}</FieldDescription>}
      </Field>
    )
  }

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center gap-3 pr-8">
          <IntegrationTile integration={i} />
          <div className="min-w-0">
            <SheetTitle className="flex items-center gap-2">
              {i.name} <StatusBadge status={i.status} />
            </SheetTitle>
            <SheetDescription>
              {INTEGRATION_CATEGORY_LABELS[i.category]} · Feeds {i.feeds}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Credentials</h3>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-center gap-2">
                <KeyRoundIcon className="size-4 text-muted-foreground" />
                <code className="truncate font-mono text-sm">{i.apiKeyMasked ?? "—"}</code>
              </div>
              {!rotating && (
                <Button size="sm" variant="outline" onClick={() => setRotating(true)}>
                  Rotate key
                </Button>
              )}
            </div>
            {rotating && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="password"
                  autoFocus
                  autoComplete="off"
                  placeholder="New API key (min 8 characters)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  disabled={rotateBusy}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-8" onClick={rotate} disabled={rotateBusy}>
                    {rotateBusy && <Loader2Icon className="animate-spin" />}
                    Save key
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    disabled={rotateBusy}
                    onClick={() => {
                      setRotating(false)
                      setNewKey("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Settings</h3>
            <FieldGroup className="gap-4">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="cfg-autoSync">Auto sync</FieldLabel>
                  <FieldDescription>Pull new data on a schedule.</FieldDescription>
                </FieldContent>
                <Switch id="cfg-autoSync" checked={draft.autoSync === true} onCheckedChange={(v) => set("autoSync", v)} />
              </Field>
              <Field data-disabled={draft.autoSync !== true}>
                <FieldLabel htmlFor="cfg-interval">Sync interval</FieldLabel>
                <Select value={String(draft.syncInterval)} onValueChange={(v) => set("syncInterval", v)} disabled={draft.autoSync !== true}>
                  <SelectTrigger id="cfg-interval" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_INTERVALS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <FieldSeparator>{INTEGRATION_CATEGORY_LABELS[i.category]}</FieldSeparator>
              {fields.map(renderField)}
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={save} disabled={!dirty || hasErrors}>
                Save settings
              </Button>
            </div>
          </section>

          {i.usage && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium">Usage</h3>
              <div className="rounded-lg border p-3">
                <UsageBar usage={i.usage} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {(i.usage.limit - i.usage.used).toLocaleString()} {i.usage.unit} remaining this billing cycle.
                </p>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Recent syncs</h3>
              <span className="text-xs text-muted-foreground">Last sync {timeAgo(i.lastSyncAt)}</span>
            </div>
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground">No syncs yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {log.map((e) => (
                  <li key={e.at} className="flex items-center gap-3 px-3 py-2 text-sm">
                    {e.ok ? (
                      <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircleIcon className="size-4 shrink-0 text-destructive" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{e.message}</span>
                    <Badge variant="outline" className="hidden font-normal tabular-nums sm:inline-flex">
                      {(e.durationMs / 1000).toFixed(1)}s
                    </Badge>
                    <span className="shrink-0 text-xs text-muted-foreground">{dateTime(e.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>

      <SheetFooter className="border-t sm:flex-row sm:justify-between">
        <Button variant="destructive" onClick={() => setConfirmDisconnect(true)}>
          <UnplugIcon /> Disconnect
        </Button>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </SheetFooter>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={`Disconnect ${i.name}?`}
        description={`SellEasy will stop pulling data from ${i.name} and the stored API key will be deleted. ${i.feeds} will no longer receive updates from this provider.`}
        confirmLabel="Disconnect"
        onConfirm={() => {
          disconnectIntegration(i.id)
          toast.success(`${i.name} disconnected`)
          onClose()
        }}
      />
    </>
  )
}
