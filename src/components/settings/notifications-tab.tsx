"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"

const STORAGE_KEY = "selleasy-notif-prefs"

const EVENTS = [
  { key: "highIntent", label: "New high-intent signal", description: "When a Tier A/B account crosses your intent threshold." },
  { key: "draftsAwaiting", label: "Drafts awaiting approval", description: "The orchestration agent drafted outreach that needs review." },
  { key: "positiveReplies", label: "Positive replies", description: "A prospect replied with interest or asked to meet." },
  { key: "dealStage", label: "Deal stage changes", description: "Deals you own move stages, locally or from the CRM." },
  { key: "integrationErrors", label: "Integration errors", description: "A vendor sync fails or an API key is rejected." },
] as const

const CHANNELS = [
  { key: "inApp", label: "In-app", description: "Bell icon in the header." },
  { key: "email", label: "Email", description: "Sent to your account email." },
  { key: "slack", label: "Slack", description: "Direct message from the SellEasy bot." },
] as const

type Prefs = Record<(typeof EVENTS)[number]["key"] | (typeof CHANNELS)[number]["key"], boolean>

const DEFAULTS: Prefs = {
  highIntent: true,
  draftsAwaiting: true,
  positiveReplies: true,
  dealStage: false,
  integrationErrors: true,
  inApp: true,
  email: true,
  slack: false,
}

function loadPrefs(): Prefs {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    const out = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS) as (keyof Prefs)[]) if (typeof parsed[k] === "boolean") out[k] = parsed[k]
    return out
  } catch {
    return DEFAULTS
  }
}

export function NotificationsTab() {
  const [saved, setSaved] = useState<Prefs>(loadPrefs)
  const [prefs, setPrefs] = useState<Prefs>(saved)
  const dirty = (Object.keys(prefs) as (keyof Prefs)[]).some((k) => prefs[k] !== saved[k])
  const noChannel = !prefs.inApp && !prefs.email && !prefs.slack

  const toggle = (k: keyof Prefs, v: boolean) => setPrefs((p) => ({ ...p, [k]: v }))

  const save = () => {
    if (noChannel) {
      toast.error("Enable at least one delivery channel")
      return
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
      setSaved(prefs)
      toast.success("Notification preferences saved")
    } catch {
      toast.error("Couldn't save preferences in this browser")
    }
  }

  const row = (item: { key: keyof Prefs; label: string; description: string }) => (
    <Field key={item.key} orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={`notif-${item.key}`}>{item.label}</FieldLabel>
        <FieldDescription>{item.description}</FieldDescription>
      </FieldContent>
      <Switch id={`notif-${item.key}`} checked={prefs[item.key]} onCheckedChange={(v) => toggle(item.key, v)} />
    </Field>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose what SellEasy alerts you about and where.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-4">
          <h3 className="text-sm font-medium">Events</h3>
          {EVENTS.map(row)}
          <FieldSeparator />
          <h3 className="text-sm font-medium">Channels</h3>
          {CHANNELS.map(row)}
          {noChannel && <p className="text-sm text-destructive">Enable at least one channel to receive notifications.</p>}
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" disabled={!dirty} onClick={() => setPrefs(saved)}>
          Discard
        </Button>
        <Button disabled={!dirty} onClick={save}>
          Save preferences
        </Button>
      </CardFooter>
    </Card>
  )
}
