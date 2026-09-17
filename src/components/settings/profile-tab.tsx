"use client"

import { useState } from "react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/shared/avatars"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ROLE_LABELS } from "@/lib/constants"
import { useCurrentUser, useStore } from "@/lib/store"
import type { User } from "@/lib/types"
import { EMAIL_RE } from "./shared"

export function ProfileTab() {
  const user = useCurrentUser()
  if (!user) return null
  return (
    <div className="space-y-6">
      <ProfileForm key={user.id} user={user} />
      <PasswordForm />
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const updateProfile = useStore((s) => s.updateProfile)
  const users = useStore((s) => s.users)
  const [name, setName] = useState(user.name)
  const [title, setTitle] = useState(user.title ?? "")
  const [email, setEmail] = useState(user.email)
  const [submitted, setSubmitted] = useState(false)

  const emailTaken = users.some((u) => u.id !== user.id && u.email.toLowerCase() === email.trim().toLowerCase())
  const errors = {
    name: name.trim().length < 2 ? "Name is required." : null,
    email: !EMAIL_RE.test(email.trim()) ? "Enter a valid email address." : emailTaken ? "Another member already uses this email." : null,
  }
  const dirty = name !== user.name || title !== (user.title ?? "") || email !== user.email

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (errors.name || errors.email) return
    updateProfile({ name: name.trim(), title: title.trim() || undefined, email: email.trim() })
    toast.success("Profile updated")
    setSubmitted(false)
  }

  return (
    <Card>
      <form onSubmit={save} className="contents">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear to teammates and in agent activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <UserAvatar user={{ name: name || user.name, avatarColor: user.avatarColor }} className="size-16 [&_[data-slot=avatar-fallback]]:text-xl" />
            <div className="min-w-0">
              <div className="truncate font-medium">{name || user.name}</div>
              <div className="truncate text-sm text-muted-foreground">{email}</div>
              <Badge variant="secondary" className="mt-1">
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
          </div>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={submitted && !!errors.name}>
              <FieldLabel htmlFor="p-name">Full name</FieldLabel>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && !!errors.name} />
              {submitted && errors.name && <FieldError>{errors.name}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="p-title">Job title</FieldLabel>
              <Input id="p-title" value={title} placeholder="e.g. Account Executive" onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field data-invalid={submitted && !!errors.email} className="sm:col-span-2">
              <FieldLabel htmlFor="p-email">Email</FieldLabel>
              <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={submitted && !!errors.email} />
              {submitted && errors.email ? (
                <FieldError>{errors.email}</FieldError>
              ) : (
                <FieldDescription>Used for sign-in and notifications.</FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty}
            onClick={() => {
              setName(user.name)
              setTitle(user.title ?? "")
              setEmail(user.email)
              setSubmitted(false)
            }}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!dirty}>
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function PasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const errors = {
    current: !current ? "Enter your current password." : null,
    next: next.length < 8 ? "Use at least 8 characters." : next === current ? "New password must differ from the current one." : null,
    confirm: confirm !== next ? "Passwords don't match." : null,
  }
  const invalid = !!(errors.current || errors.next || errors.confirm)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (invalid) return
    toast.success("Password changed", { description: "Other sessions have been signed out." })
    setCurrent("")
    setNext("")
    setConfirm("")
    setSubmitted(false)
  }

  const show = (k: keyof typeof errors) => submitted && errors[k]

  return (
    <Card>
      <form onSubmit={submit} className="contents">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Choose a strong password you don&apos;t use elsewhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={!!show("current")}>
              <FieldLabel htmlFor="pw-current">Current password</FieldLabel>
              <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={!!show("current")} />
              {show("current") && <FieldError>{errors.current}</FieldError>}
            </Field>
            <Field data-invalid={!!show("next")}>
              <FieldLabel htmlFor="pw-new">New password</FieldLabel>
              <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!!show("next")} />
              {show("next") ? <FieldError>{errors.next}</FieldError> : <FieldDescription>At least 8 characters.</FieldDescription>}
            </Field>
            <Field data-invalid={!!show("confirm")}>
              <FieldLabel htmlFor="pw-confirm">Confirm new password</FieldLabel>
              <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!show("confirm")} />
              {show("confirm") && <FieldError>{errors.confirm}</FieldError>}
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit">Update password</Button>
        </CardFooter>
      </form>
    </Card>
  )
}
