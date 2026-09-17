"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"
import { UserAvatar } from "@/components/shared/avatars"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError, useChangePassword, useCurrentUser, useUpdateProfile } from "@/lib/api"
import { ROLE_LABELS } from "@/lib/constants"
import type { User } from "@/lib/types"
import { EMAIL_RE } from "./shared"

export function ProfileTab() {
  const user = useCurrentUser()
  return (
    <div className="space-y-6">
      <ProfileForm key={user.id} user={user} />
      <PasswordForm />
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const updateProfile = useUpdateProfile()
  const [name, setName] = useState(user.name)
  const [title, setTitle] = useState(user.title ?? "")
  const [email, setEmail] = useState(user.email)
  const [submitted, setSubmitted] = useState(false)
  // Errors reported by the API (e.g. 409 duplicate email), cleared when the field is edited.
  const [serverErrors, setServerErrors] = useState<{ name?: string; title?: string; email?: string }>({})

  const errors = {
    name: name.trim().length < 2 ? "Name is required." : (serverErrors.name ?? null),
    title: serverErrors.title ?? null,
    email: !EMAIL_RE.test(email.trim()) ? "Enter a valid email address." : (serverErrors.email ?? null),
  }
  const dirty = name !== user.name || title !== (user.title ?? "") || email !== user.email
  const busy = updateProfile.isPending

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (errors.name || errors.email || errors.title) return
    updateProfile.mutate(
      { name: name.trim(), title: title.trim(), email: email.trim() },
      {
        onSuccess: (u) => {
          setName(u.name)
          setTitle(u.title ?? "")
          setEmail(u.email)
          setSubmitted(false)
        },
        onError: (err) => {
          if (!(err instanceof ApiError)) return
          if (err.status === 409) setServerErrors({ email: err.message })
          else {
            const f = err.fieldErrors
            setServerErrors({ name: f.name?.[0], title: f.title?.[0], email: f.email?.[0] })
          }
        },
      },
    )
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
              <Input id="p-name" value={name} onChange={(e) => {
                  setName(e.target.value)
                  setServerErrors((x) => ({ ...x, name: undefined }))
                }}
                aria-invalid={submitted && !!errors.name}
              />
              {submitted && errors.name && <FieldError>{errors.name}</FieldError>}
            </Field>
            <Field data-invalid={submitted && !!errors.title}>
              <FieldLabel htmlFor="p-title">Job title</FieldLabel>
              <Input
                id="p-title"
                value={title}
                placeholder="e.g. Account Executive"
                onChange={(e) => {
                  setTitle(e.target.value)
                  setServerErrors((x) => ({ ...x, title: undefined }))
                }}
                aria-invalid={submitted && !!errors.title}
              />
              {submitted && errors.title && <FieldError>{errors.title}</FieldError>}
            </Field>
            <Field data-invalid={submitted && !!errors.email} className="sm:col-span-2">
              <FieldLabel htmlFor="p-email">Email</FieldLabel>
              <Input id="p-email" type="email" value={email} onChange={(e) => {
                  setEmail(e.target.value)
                  setServerErrors((x) => ({ ...x, email: undefined }))
                }}
                aria-invalid={submitted && !!errors.email}
              />
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
            onClick={() => {
              setName(user.name)
              setTitle(user.title ?? "")
              setEmail(user.email)
              setSubmitted(false)
              setServerErrors({})
            }}
            disabled={!dirty || busy}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!dirty || busy}>
            {busy && <Loader2Icon className="animate-spin" />}
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function PasswordForm() {
  const changePassword = useChangePassword()
  const [serverErrors, setServerErrors] = useState<{ current?: string; next?: string }>({})
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const errors = {
    current: !current ? "Enter your current password." : (serverErrors.current ?? null),
    next:
      next.length < 8
        ? "Use at least 8 characters."
        : next === current
          ? "New password must differ from the current one."
          : (serverErrors.next ?? null),
    confirm: confirm !== next ? "Passwords don't match." : null,
  }
  const invalid = !!(errors.current || errors.next || errors.confirm)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (invalid) return
    changePassword.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent("")
          setNext("")
          setConfirm("")
          setSubmitted(false)
        },
        onError: (err) => {
          if (!(err instanceof ApiError)) return
          const f = err.fieldErrors
          if (f.currentPassword || f.newPassword) setServerErrors({ current: f.currentPassword?.[0], next: f.newPassword?.[0] })
          // A 400 without field details means the current password was rejected.
          else if (err.status === 400) setServerErrors({ current: err.message })
        },
      },
    )
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
              <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setServerErrors({}) }} aria-invalid={!!show("current")} />
              {show("current") && <FieldError>{errors.current}</FieldError>}
            </Field>
            <Field data-invalid={!!show("next")}>
              <FieldLabel htmlFor="pw-new">New password</FieldLabel>
              <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setServerErrors((x) => ({ ...x, next: undefined })) }} aria-invalid={!!show("next")} />
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
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending && <Loader2Icon className="animate-spin" />}
            Update password
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
