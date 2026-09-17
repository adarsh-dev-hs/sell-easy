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
import { ApiError, useConnectIntegration } from "@/lib/api"
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
  const connect = useConnectIntegration()
  const [key, setKey] = useState("")
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const busy = connect.isPending
  const error = key.trim().length < 8 ? "API key must be at least 8 characters." : serverError
  const reconnect = integration.connected || integration.status === "error"

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (error) return
    connect.mutate(
      { id: integration.id, apiKey: key.trim() },
      {
        onSuccess: (i) => {
          toast.success(`${i.name} ${reconnect ? "reconnected" : "connected"}`, { description: `Now feeding ${i.feeds}.` })
          onDone()
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 400) setServerError(err.fieldErrors.apiKey?.[0] ?? err.message)
        },
      },
    )
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
            onChange={(e) => {
              setKey(e.target.value)
              setServerError(null)
            }}
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
