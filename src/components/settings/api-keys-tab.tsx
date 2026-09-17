"use client"

import { useMemo, useState } from "react"
import { KeyRoundIcon, PlusIcon, TriangleAlertIcon, WebhookIcon } from "lucide-react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_SCOPES } from "@/lib/constants"
import { shortDate, timeAgo } from "@/lib/format"
import { useCurrentUser, useLookup, useStore } from "@/lib/store"
import type { ApiKey } from "@/lib/types"
import { canManageOrg, CopyButton } from "./shared"

const INGEST_URL = "https://api.selleasy.dev/v1/signals/ingest"

const CURL_EXAMPLE = `curl -X POST ${INGEST_URL} \\
  -H "Authorization: Bearer $SELLEASY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "website_visit",
    "domain": "acme.com",
    "title": "Visited pricing page",
    "strength": 80,
    "source": "custom"
  }'`

export function ApiKeysTab() {
  const apiKeys = useStore((s) => s.apiKeys)
  const revokeApiKey = useStore((s) => s.revokeApiKey)
  const lookup = useLookup()
  const me = useCurrentUser()
  const canManage = canManageOrg(me?.role)
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)

  const sorted = useMemo(
    () => [...apiKeys].sort((a, b) => Number(a.revoked) - Number(b.revoked) || b.createdAt.localeCompare(a.createdAt)),
    [apiKeys],
  )
  const activeCount = apiKeys.filter((k) => !k.revoked).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            {activeCount} active key{activeCount === 1 ? "" : "s"}. Use keys to push signals and read data from your own systems.
          </CardDescription>
          <CardAction>
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!canManage}>
              <PlusIcon /> Create API key
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <EmptyState icon={KeyRoundIcon} title="No API keys yet" description="Create a key to start calling the SellEasy API." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead className="hidden lg:table-cell">Created by</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="hidden md:table-cell">Last used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((k) => {
                    const creator = lookup.user(k.createdBy)
                    return (
                      <TableRow key={k.id} className={k.revoked ? "opacity-60" : undefined}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell>
                          <code className="font-mono text-xs">{k.prefix}••••</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-64 flex-wrap gap-1">
                            {k.scopes.map((s) => (
                              <Badge key={s} variant="outline" className="font-mono text-[10px] font-normal">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <UserAvatar user={creator} />
                            <span className="truncate">{creator?.name ?? "Former member"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{shortDate(k.createdAt)}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}</TableCell>
                        <TableCell>
                          <StatusBadge status={k.revoked ? "revoked" : "active"} tone={k.revoked ? "danger" : "success"} />
                        </TableCell>
                        <TableCell className="text-right">
                          {!k.revoked && (
                            <Button size="sm" variant="ghost" className="text-destructive" disabled={!canManage} onClick={() => setRevokeTarget(k)}>
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WebhookIcon className="size-4" /> Webhook endpoint
          </CardTitle>
          <CardDescription>POST custom signals from any source. Requires a key with the signals:write scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-1.5 font-mono text-xs">{INGEST_URL}</code>
            <CopyButton value={INGEST_URL} toastLabel="Endpoint URL copied" />
          </div>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 pr-12 font-mono text-xs leading-relaxed">{CURL_EXAMPLE}</pre>
            <div className="absolute top-2 right-2">
              <CopyButton value={CURL_EXAMPLE} size="icon-sm" variant="ghost" label="Copy curl example" toastLabel="Example copied" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          {createOpen && <CreateKeyFlow onDone={() => setCreateOpen(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title={`Revoke “${revokeTarget?.name}”?`}
        description="Any integration using this key will immediately stop working. This can't be undone."
        confirmLabel="Revoke key"
        onConfirm={() => {
          if (!revokeTarget) return
          revokeApiKey(revokeTarget.id)
          toast.success(`Revoked “${revokeTarget.name}”`)
          setRevokeTarget(null)
        }}
      />
    </div>
  )
}

function CreateKeyFlow({ onDone }: { onDone: () => void }) {
  const createApiKey = useStore((s) => s.createApiKey)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<string[]>(["accounts:read"])
  const [submitted, setSubmitted] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)

  const errors = {
    name: name.trim().length < 3 ? "Give the key a descriptive name (3+ characters)." : null,
    scopes: scopes.length === 0 ? "Select at least one scope." : null,
  }

  const toggle = (scope: string, on: boolean) =>
    setScopes((s) => (on ? [...s, scope] : s.filter((x) => x !== scope)).sort((a, b) => API_SCOPES.indexOf(a) - API_SCOPES.indexOf(b)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (errors.name || errors.scopes) return
    setSecret(createApiKey(name.trim(), scopes))
    toast.success("API key created")
  }

  if (secret) {
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Save your API key</DialogTitle>
          <DialogDescription>“{name.trim()}” was created with {scopes.length} scope{scopes.length === 1 ? "" : "s"}.</DialogDescription>
        </DialogHeader>
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>This is the only time you&apos;ll see this key</AlertTitle>
          <AlertDescription>Copy it now and store it somewhere safe. If you lose it, revoke it and create a new one.</AlertDescription>
        </Alert>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs break-all select-all">{secret}</code>
          <CopyButton value={secret} toastLabel="API key copied" />
        </div>
        <DialogFooter>
          <Button onClick={onDone}>I&apos;ve saved it</Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Create API key</DialogTitle>
        <DialogDescription>Grant only the scopes this integration needs.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-4">
        <Field data-invalid={submitted && !!errors.name}>
          <FieldLabel htmlFor="key-name">Name</FieldLabel>
          <Input
            id="key-name"
            autoFocus
            placeholder="e.g. Segment signal forwarder"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={submitted && !!errors.name}
          />
          {submitted && errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <FieldSet data-invalid={submitted && !!errors.scopes}>
          <FieldLegend variant="label">Scopes</FieldLegend>
          <FieldDescription>Read scopes are safe to share with BI tools; write scopes can change data.</FieldDescription>
          <div className="grid gap-2 sm:grid-cols-2">
            {API_SCOPES.map((scope) => (
              <Field key={scope} orientation="horizontal">
                <Checkbox id={`scope-${scope}`} checked={scopes.includes(scope)} onCheckedChange={(v) => toggle(scope, v === true)} />
                <FieldLabel htmlFor={`scope-${scope}`} className="font-mono text-xs font-normal">
                  {scope}
                </FieldLabel>
              </Field>
            ))}
          </div>
          {submitted && errors.scopes && <FieldError>{errors.scopes}</FieldError>}
        </FieldSet>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Create key</Button>
      </DialogFooter>
    </form>
  )
}
