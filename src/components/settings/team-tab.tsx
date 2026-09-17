"use client"

import { useMemo, useState } from "react"
import { CheckIcon, Loader2Icon, MailIcon, MinusIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon, UserPlusIcon } from "lucide-react"
import { UserAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { QueryError, TableSkeleton } from "@/components/shared/query-state"
import { StatusBadge } from "@/components/shared/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import {
  ApiError,
  isAdmin,
  useCurrentUser,
  useInviteUser,
  useOrg,
  useRemoveUser,
  useResendInvite,
  useUpdateUser,
  useUsers,
} from "@/lib/api"
import { ROLE_LABELS } from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import type { Role, User } from "@/lib/types"
import { CopyButton, EMAIL_RE } from "./shared"

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

const inviteUrl = (token: string) => `${window.location.origin}/login?invite=${encodeURIComponent(token)}`

/** Email delivery isn't wired up yet, so admins share the invite link manually. */
function InviteLink({ email, token }: { email: string; token: string }) {
  const url = inviteUrl(token)
  return (
    <Alert>
      <MailIcon />
      <AlertTitle>Share this invite link with {email}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>Email delivery isn&apos;t configured, so send them this link to join. It replaces any earlier link.</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 rounded-md border bg-muted/50 px-3 py-1.5 font-mono text-xs break-all select-all">{url}</code>
          <CopyButton value={url} toastLabel="Invite link copied" />
        </div>
      </AlertDescription>
    </Alert>
  )
}

export function TeamTab() {
  const users = useUsers()
  const org = useOrg()
  const updateUser = useUpdateUser()
  const removeUser = useRemoveUser()
  const resendInvite = useResendInvite()
  const me = useCurrentUser()
  const canManage = isAdmin(me.role)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)
  const [titleTarget, setTitleTarget] = useState<User | null>(null)
  const [resent, setResent] = useState<{ email: string; token: string } | null>(null)

  const sorted = useMemo(
    () => [...(users.data ?? [])].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name)),
    [users.data],
  )
  const seats = org.data?.seats
  const seatsUsed = org.data?.seatsUsed
  const seatsFull = seats !== undefined && seatsUsed !== undefined && seatsUsed >= seats

  const changeRole = (u: User, role: Role) => {
    if (u.role === "owner" || u.id === me.id || role === "owner") return
    updateUser.mutate({ id: u.id, role })
  }

  const resend = (u: User) =>
    resendInvite.mutate(u.id, { onSuccess: (r) => setResent({ email: r.user.email, token: r.inviteToken }) })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {seats !== undefined ? `${seatsUsed} of ${seats} seats used` : "Loading seats…"}
            {!canManage && " · Only owners and admins can manage members."}
          </CardDescription>
          <CardAction>
            <Button size="sm" disabled={!canManage} onClick={() => setInviteOpen(true)}>
              <UserPlusIcon /> Invite member
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {users.isError ? (
            <QueryError error={users.error} onRetry={() => users.refetch()} />
          ) : users.isPending ? (
            <TableSkeleton rows={4} className="rounded-lg border" />
          ) : (
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
                  const isMe = u.id === me.id
                  const isOwner = u.role === "owner"
                  const roleLocked = !canManage || isOwner || isMe || (updateUser.isPending && updateUser.variables?.id === u.id)
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
                            <DropdownMenuItem onSelect={() => setTitleTarget(u)}>
                              <PencilIcon /> Edit title
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={u.status !== "invited" || resendInvite.isPending} onSelect={() => resend(u)}>
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
          )}
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
          {inviteOpen && (
            <InviteForm
              seatsFull={seatsFull}
              seats={seats}
              users={users.data ?? []}
              orgName={org.data?.name}
              orgDomain={org.data?.domain}
              onDone={() => setInviteOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resent} onOpenChange={(o) => !o && setResent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitation re-sent</DialogTitle>
            <DialogDescription>A fresh invite link was generated for {resent?.email}.</DialogDescription>
          </DialogHeader>
          {resent && <InviteLink email={resent.email} token={resent.token} />}
          <DialogFooter>
            <Button onClick={() => setResent(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!titleTarget} onOpenChange={(o) => !o && setTitleTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {titleTarget && <TitleForm key={titleTarget.id} user={titleTarget} onDone={() => setTitleTarget(null)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={removeTarget?.status === "invited" ? `Revoke invite for ${removeTarget?.email}?` : `Remove ${removeTarget?.name}?`}
        description="They will lose access immediately. Accounts they own will become unassigned."
        confirmLabel={removeTarget?.status === "invited" ? "Revoke invite" : "Remove member"}
        onConfirm={() => {
          if (!removeTarget || removeTarget.id === me.id || removeTarget.role === "owner") return
          removeUser.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) })
        }}
      />
    </div>
  )
}

function TitleForm({ user, onDone }: { user: User; onDone: () => void }) {
  const updateUser = useUpdateUser()
  const [title, setTitle] = useState(user.title ?? "")
  const error = title.trim().length > 120 ? "Keep the title under 120 characters." : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (error) return
    updateUser.mutate({ id: user.id, title: title.trim() }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Edit title</DialogTitle>
        <DialogDescription>Job title shown for {user.name} across SellEasy.</DialogDescription>
      </DialogHeader>
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="member-title">Job title</FieldLabel>
        <Input id="member-title" autoFocus value={title} placeholder="e.g. Account Executive" onChange={(e) => setTitle(e.target.value)} />
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={updateUser.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateUser.isPending || title.trim() === (user.title ?? "")}>
          {updateUser.isPending && <Loader2Icon className="animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

function InviteForm({
  seatsFull,
  seats,
  users,
  orgName,
  orgDomain,
  onDone,
}: {
  seatsFull: boolean
  seats?: number
  users: User[]
  orgName?: string
  orgDomain?: string
  onDone: () => void
}) {
  const inviteUser = useInviteUser()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Exclude<Role, "owner">>("member")
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [invited, setInvited] = useState<{ email: string; token: string } | null>(null)

  const trimmed = email.trim().toLowerCase()
  const error = !EMAIL_RE.test(trimmed)
    ? "Enter a valid email address."
    : users.some((u) => u.email.toLowerCase() === trimmed)
      ? "This person is already a member or has a pending invite."
      : serverError

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (seatsFull || error) return
    inviteUser.mutate(
      { email: trimmed, role },
      {
        onSuccess: (r) => setInvited({ email: r.user.email, token: r.inviteToken }),
        onError: (err) => {
          if (err instanceof ApiError && (err.status === 409 || err.fieldErrors.email)) setServerError(err.fieldErrors.email?.[0] ?? err.message)
        },
      },
    )
  }

  if (invited) {
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Invitation created</DialogTitle>
          <DialogDescription>
            {invited.email} will join {orgName ?? "your workspace"} as {ROLE_LABELS[role]}.
          </DialogDescription>
        </DialogHeader>
        <InviteLink email={invited.email} token={invited.token} />
        <DialogFooter>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Invite a teammate</DialogTitle>
        <DialogDescription>You&apos;ll get a link they can use to join {orgName ?? "your workspace"}.</DialogDescription>
      </DialogHeader>
      {seatsFull && (
        <Alert variant="destructive">
          <AlertDescription>
            All {seats} seats are in use. Upgrade your plan in the Organization tab to invite more people.
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
            placeholder={`name@${orgDomain ?? "company.com"}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setServerError(null)
            }}
            aria-invalid={submitted && !!error}
            disabled={seatsFull || inviteUser.isPending}
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
        <Button type="button" variant="outline" onClick={onDone} disabled={inviteUser.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={seatsFull || inviteUser.isPending}>
          {inviteUser.isPending ? <Loader2Icon className="animate-spin" /> : <MailIcon />} Send invite
        </Button>
      </DialogFooter>
    </form>
  )
}
