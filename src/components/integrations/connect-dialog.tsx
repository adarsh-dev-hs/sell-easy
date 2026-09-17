"use client"

import { useState } from "react"
import { Loader2Icon, PlugZapIcon } from "lucide-react"
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"
import type { Integration } from "@/lib/types"

export function ConnectDialog({
  integration,
  onOpenChange,
}: {
  integration: Integration | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!integration} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {integration && <ConnectForm key={integration.id} integration={integration} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ConnectForm({ integration, onDone }: { integration: Integration; onDone: () => void }) {
  const connectIntegration = useStore((s) => s.connectIntegration)
  const [key, setKey] = useState("")
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const error = key.trim().length < 8 ? "API key must be at least 8 characters." : null
  const reconnect = integration.connected

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (error) return
    setBusy(true)
    try {
      await connectIntegration(integration.id, key.trim())
      toast.success(`${integration.name} ${reconnect ? "reconnected" : "connected"}`, {
        description: `Now feeding ${integration.feeds}.`,
      })
      onDone()
    } catch {
      toast.error(`Could not connect ${integration.name}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>
          {reconnect ? "Reconnect" : "Connect"} {integration.name}
        </DialogTitle>
        <DialogDescription>{integration.description}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={touched && !!error}>
          <FieldLabel htmlFor="int-api-key">API key</FieldLabel>
          <Input
            id="int-api-key"
            type="password"
            autoComplete="off"
            autoFocus
            placeholder="Paste your API key"
            value={key}
            aria-invalid={touched && !!error}
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => setTouched(true)}
            disabled={busy}
          />
          {touched && error ? (
            <FieldError>{error}</FieldError>
          ) : (
            <FieldDescription>Keys are encrypted at rest and only the last 4 characters are shown.</FieldDescription>
          )}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />}
          {busy ? "Verifying…" : reconnect ? "Reconnect" : "Connect"}
        </Button>
      </DialogFooter>
    </form>
  )
}
