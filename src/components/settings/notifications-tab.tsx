"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"
import { QueryError } from "@/components/shared/query-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { usePreferences, useSavePreferences } from "@/lib/api"
import type { UserPreferences } from "@/lib/types"

const EVENTS = [
  { key: "highIntentSignal", label: "New high-intent signal", description: "When a Tier A/B account crosses your intent threshold." },
  { key: "draftsAwaitingApproval", label: "Drafts awaiting approval", description: "The orchestration agent drafted outreach that needs review." },
  { key: "positiveReplies", label: "Positive replies", description: "A prospect replied with interest or asked to meet." },
  { key: "dealStageChanges", label: "Deal stage changes", description: "Deals you own move stages, locally or from the CRM." },
  { key: "integrationErrors", label: "Integration errors", description: "A vendor sync fails or an API key is rejected." },
] as const

const CHANNELS = [
  { key: "inApp", label: "In-app", description: "Bell icon in the header." },
  { key: "email", label: "Email", description: "Sent to your account email." },
  { key: "slack", label: "Slack", description: "Direct message from the SellEasy bot." },
] as const

type Group = keyof UserPreferences

export function NotificationsTab() {
  const prefs = usePreferences()

  if (prefs.isError) return <QueryError error={prefs.error} onRetry={() => prefs.refetch()} />
  if (!prefs.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose what SellEasy alerts you about and where.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 8 }).map((_, n) => (
            <Skeleton key={n} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }
  // Re-key when the saved preferences change so the draft re-initialises from the server.
  return <NotificationsForm key={JSON.stringify(prefs.data)} saved={prefs.data} />
}

function NotificationsForm({ saved }: { saved: UserPreferences }) {
  const savePrefs = useSavePreferences()
  const [prefs, setPrefs] = useState<UserPreferences>(saved)

  const get = (group: Group, key: string) => prefs[group][key] === true
  const dirty = (["notifications", "channels"] as const).some((g) =>
    [...EVENTS, ...CHANNELS].some((item) => (prefs[g][item.key] === true) !== (saved[g][item.key] === true)),
  )
  const noChannel = !CHANNELS.some((c) => get("channels", c.key))

  const toggle = (group: Group, key: string, v: boolean) => setPrefs((p) => ({ ...p, [group]: { ...p[group], [key]: v } }))

  const save = () => {
    if (noChannel) return
    savePrefs.mutate(prefs)
  }

  const row = (group: Group, item: { key: string; label: string; description: string }) => (
    <Field key={item.key} orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={`notif-${item.key}`}>{item.label}</FieldLabel>
        <FieldDescription>{item.description}</FieldDescription>
      </FieldContent>
      <Switch id={`notif-${item.key}`} checked={get(group, item.key)} onCheckedChange={(v) => toggle(group, item.key, v)} />
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
          {EVENTS.map((item) => row("notifications", item))}
          <FieldSeparator />
          <h3 className="text-sm font-medium">Channels</h3>
          {CHANNELS.map((item) => row("channels", item))}
          {noChannel && <p className="text-sm text-destructive">Enable at least one channel to receive notifications.</p>}
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" disabled={!dirty || savePrefs.isPending} onClick={() => setPrefs(saved)}>
          Discard
        </Button>
        <Button disabled={!dirty || noChannel || savePrefs.isPending} onClick={save}>
          {savePrefs.isPending && <Loader2Icon className="animate-spin" />}
          Save preferences
        </Button>
      </CardFooter>
    </Card>
  )
}
