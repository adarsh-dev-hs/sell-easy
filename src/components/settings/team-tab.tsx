"use client"

import { useMemo, useState } from "react"
import { CheckIcon, MailIcon, MinusIcon, MoreHorizontalIcon, Trash2Icon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ROLE_LABELS } from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import { useCurrentUser, useStore } from "@/lib/store"
import type { Role, User } from "@/lib/types"
import { canManageOrg, EMAIL_RE } from "./shared"

const ASSIGNABLE_ROLES: Exclude<Role, "owner">[] = ["admin", "member", "viewer"]

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full access, including billing and deleting the workspace.",
  admin: "Manage team, integrations and ICP. No billing.",
  member: "Work accounts, run sequences and approve agent drafts.",
  viewer: "Read-only access to data and reports.",
}

const CAPABILITIES: { label: string; roles: Role[] }[] = [
  { label: "Manage billing", roles: ["owner"] },
  { label: "Manage team & roles", roles: ["owner", "admin"] },
  { label: "Manage integrations", roles: ["owner", "admin"] },
  { label: "Manage API keys", roles: ["owner", "admin"] },
  { label: "Edit ICP & scoring", roles: ["owner", "admin"] },
  { label: "Approve agent drafts", roles: ["owner", "admin", "member"] },
  { label: "Run sequences", roles: ["owner", "admin", "member"] },
  { label: "View data", roles: ["owner", "admin", "member", "viewer"] },
]

const ROLES: Role[] = ["owner", "admin", "member", "viewer"]

export function TeamTab() {
  const users = useStore((s) => s.users)
  const org = useStore((s) => s.org)
  const updateUser = useStore((s) => s.updateUser)
  const removeUser = useStore((s) => s.removeUser)
  const me = useCurrentUser()
  const canManage = canManageOrg(me?.role)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)

  const sorted = useMemo(
    () => [...users].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name)),
    [users],
  )
  const seatsFull = users.length >= org.seats

  const changeRole = (u: User, role: Role) => {
    if (u.role === "owner" || u.id === me?.id) return
    updateUser(u.id, { role })
    toast.success(`${u.name}'s role changed to ${ROLE_LABELS[role]}`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {users.length} of {org.seats} seats used
            {!canManage && " · Only owners and admins can manage members."}
          </CardDescription>
          <CardAction>
            <Button size="sm" disabled={!canManage} onClick={() => setInviteOpen(true)}>
              <UserPlusIcon /> Invite member
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden md:table-cell">Title</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Last active</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((u) => {
                  const isMe = u.id === me?.id
                  const isOwner = u.role === "owner"
                  const roleLocked = !canManage || isOwner || isMe
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={u} className="size-8" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-medium">
                              {u.name}
                              {isMe && (
                                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                  You
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{u.title ?? "—"}</TableCell>
                      <TableCell>
                        {isOwner ? (
                          <Badge variant="outline">Owner</Badge>
                        ) : (
                          <Select value={u.role} onValueChange={(v) => changeRole(u, v as Role)} disabled={roleLocked}>
                            <SelectTrigger size="sm" className="w-28" aria-label={`Role for ${u.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {u.status === "invited" ? "Pending" : timeAgo(u.lastActiveAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${u.name}`} disabled={!canManage}>
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={u.status !== "invited"}
                              onSelect={() => toast.success(`Invitation re-sent to ${u.email}`)}
                            >
                              <MailIcon /> Resend invite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" disabled={isMe || isOwner} onSelect={() => setRemoveTarget(u)}>
                              <Trash2Icon /> {u.status === "invited" ? "Revoke invite" : "Remove member"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles & permissions</CardTitle>
          <CardDescription>What each role can do in SellEasy.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capability</TableHead>
                  {ROLES.map((r) => (
                    <TableHead key={r} className="text-center">
                      {ROLE_LABELS[r]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {CAPABILITIES.map((c) => (
                  <TableRow key={c.label}>
                    <TableCell className="font-medium">{c.label}</TableCell>
                    {ROLES.map((r) => (
                      <TableCell key={r} className="text-center">
                        {c.roles.includes(r) ? (
                          <CheckIcon className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" aria-label="Allowed" />
                        ) : (
                          <MinusIcon className="mx-auto size-4 text-muted-foreground/50" aria-label="Not allowed" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {ROLES.map((r) => (
              <div key={r}>
                <dt className="font-medium">{ROLE_LABELS[r]}</dt>
                <dd className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          {inviteOpen && <InviteForm seatsFull={seatsFull} onDone={() => setInviteOpen(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={removeTarget?.status === "invited" ? `Revoke invite for ${removeTarget?.email}?` : `Remove ${removeTarget?.name}?`}
        description="They will lose access immediately. Accounts they own will become unassigned."
        confirmLabel={removeTarget?.status === "invited" ? "Revoke invite" : "Remove member"}
        onConfirm={() => {
          if (!removeTarget) return
          if (removeTarget.id === me?.id || removeTarget.role === "owner") {
            toast.error("You can't remove yourself or the workspace owner")
            return
          }
          removeUser(removeTarget.id)
          toast.success(`${removeTarget.name} removed`)
          setRemoveTarget(null)
        }}
      />
    </div>
  )
}

function InviteForm({ seatsFull, onDone }: { seatsFull: boolean; onDone: () => void }) {
  const users = useStore((s) => s.users)
  const org = useStore((s) => s.org)
  const inviteUser = useStore((s) => s.inviteUser)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Exclude<Role, "owner">>("member")
  const [submitted, setSubmitted] = useState(false)

  const trimmed = email.trim().toLowerCase()
  const error = !EMAIL_RE.test(trimmed)
    ? "Enter a valid email address."
    : users.some((u) => u.email.toLowerCase() === trimmed)
      ? "This person is already a member or has a pending invite."
      : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (seatsFull) {
      toast.error("No seats available", { description: "Upgrade your plan to invite more teammates." })
      return
    }
    if (error) return
    inviteUser(trimmed, role)
    toast.success(`Invitation sent to ${trimmed}`, { description: `Joining as ${ROLE_LABELS[role]}.` })
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Invite a teammate</DialogTitle>
        <DialogDescription>They&apos;ll get an email with a link to join {org.name}.</DialogDescription>
      </DialogHeader>
      {seatsFull && (
        <Alert variant="destructive">
          <AlertDescription>
            All {org.seats} seats are in use. Upgrade your plan in the Organization tab to invite more people.
          </AlertDescription>
        </Alert>
      )}
      <FieldGroup className="gap-4">
        <Field data-invalid={submitted && !!error}>
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <Input
            id="invite-email"
            type="email"
            autoFocus
            placeholder={`name@${org.domain}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={submitted && !!error}
            disabled={seatsFull}
          />
          {submitted && error && <FieldError>{error}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="invite-role">Role</FieldLabel>
          <Select value={role} onValueChange={(v) => setRole(v as Exclude<Role, "owner">)} disabled={seatsFull}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{ROLE_DESCRIPTIONS[role]}</FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={seatsFull}>
          <MailIcon /> Send invite
        </Button>
      </DialogFooter>
    </form>
  )
}
