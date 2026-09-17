"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BotIcon, GaugeIcon, Loader2Icon, RadioTowerIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { API_URL, ApiError, errorMessage, IS_MOCK, useAcceptInvite, useLogin, useRegister, useSession } from "@/lib/api"

// Demo credentials for NEXT_PUBLIC_DATA_SOURCE=mock (see src/mock-api/overrides/config.ts).
const DEMO_LOGIN = { email: "jordan@acmegrowth.com", password: "demo1234" }

const FEATURES = [
  { icon: RadioTowerIcon, title: "Live buying signals", body: "Intent, hiring, funding and web visits unified per account." },
  { icon: GaugeIcon, title: "Fit + intent scoring", body: "Your ICP, your weights — every account re-scored in real time." },
  { icon: BotIcon, title: "Orchestration agent", body: "Routes, drafts and enrolls automatically with human approval." },
]

function fieldError(err: unknown, field: string) {
  return err instanceof ApiError ? err.fieldErrors[field]?.[0] : undefined
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const inviteToken = params.get("invite")
  const next = params.get("next")
  const { isAuthenticated } = useSession()
  const login = useLogin()
  const register = useRegister()
  const accept = useAcceptInvite()

  const [tab, setTab] = useState(inviteToken ? "invite" : "login")
  const [email, setEmail] = useState(IS_MOCK ? DEMO_LOGIN.email : "")
  const [password, setPassword] = useState(IS_MOCK ? DEMO_LOGIN.password : "")
  const [name, setName] = useState("")
  const [orgName, setOrgName] = useState("")
  const [domain, setDomain] = useState("")

  useEffect(() => {
    if (isAuthenticated) router.replace(next && next.startsWith("/") ? next : "/dashboard")
  }, [isAuthenticated, router, next])

  const onError = (err: unknown) => {
    if (!(err instanceof ApiError && Object.keys(err.fieldErrors).length)) toast.error(errorMessage(err))
  }

  const busy = login.isPending || register.isPending || accept.isPending

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate(
      { email, password },
      { onSuccess: (s) => toast.success(`Welcome back, ${s.user.name.split(" ")[0]}`), onError },
    )
  }

  const submitRegister = (e: React.FormEvent) => {
    e.preventDefault()
    register.mutate(
      { orgName, domain, name, email, password },
      { onSuccess: (s) => toast.success(`Workspace ${s.org.name} created`), onError },
    )
  }

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteToken) return
    accept.mutate(
      { token: inviteToken, password, name: name || undefined },
      { onSuccess: (s) => toast.success(`Welcome to ${s.org.name}`), onError },
    )
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/15">
            <ZapIcon className="size-4" />
          </div>
          SellEasy
        </div>
        <div className="space-y-8">
          <h2 className="max-w-md text-3xl font-semibold tracking-tight">Turn buying signals into pipeline — automatically.</h2>
          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <f.icon className="size-4" />
                </div>
                <div>
                  <div className="font-medium">{f.title}</div>
                  <div className="text-sm text-primary-foreground/75">{f.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-primary-foreground/70">
          {IS_MOCK ? "Demo mode · sample data stored in this browser" : `Connected to ${API_URL.replace(/^https?:\/\//, "")}`}
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Welcome to SellEasy</CardTitle>
            <CardDescription>
              {tab === "invite" ? "Set a password to join your team." : "Sign in to your workspace or create a new one."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              {!inviteToken && (
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="login">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create workspace</TabsTrigger>
                </TabsList>
              )}

              <TabsContent value="login">
                <form onSubmit={submitLogin}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="login-email">Work email</FieldLabel>
                      <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                      <FieldError>{fieldError(login.error, "email")}</FieldError>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login-password">Password</FieldLabel>
                      <Input
                        id="login-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <FieldDescription>
                        {IS_MOCK ? (
                          <>
                            Demo login: <code>{DEMO_LOGIN.email}</code> / <code>{DEMO_LOGIN.password}</code> (pre-filled).
                          </>
                        ) : (
                          <>
                            First run? Use the admin from backend <code>BOOTSTRAP_ADMIN_*</code>.
                          </>
                        )}
                      </FieldDescription>
                    </Field>
                    <Button type="submit" disabled={busy} className="w-full">
                      {login.isPending && <Loader2Icon className="animate-spin" />}
                      Sign in
                    </Button>
                  </FieldGroup>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={submitRegister}>
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="org">Company</FieldLabel>
                        <Input id="org" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." />
                        <FieldError>{fieldError(register.error, "orgName")}</FieldError>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="domain">Domain</FieldLabel>
                        <Input id="domain" required value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
                        <FieldError>{fieldError(register.error, "domain")}</FieldError>
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="name">Your name</FieldLabel>
                      <Input id="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="signup-email">Work email</FieldLabel>
                      <Input id="signup-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      <FieldError>{fieldError(register.error, "email")}</FieldError>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                      <Input
                        id="signup-password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <FieldError>{fieldError(register.error, "password")}</FieldError>
                    </Field>
                    <Button type="submit" disabled={busy} className="w-full">
                      {register.isPending && <Loader2Icon className="animate-spin" />}
                      Create workspace
                    </Button>
                  </FieldGroup>
                </form>
              </TabsContent>

              <TabsContent value="invite">
                <form onSubmit={submitInvite}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="invite-name">Your name</FieldLabel>
                      <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="invite-password">Choose a password</FieldLabel>
                      <Input
                        id="invite-password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <FieldError>{fieldError(accept.error, "password")}</FieldError>
                    </Field>
                    <Button type="submit" disabled={busy} className="w-full">
                      {accept.isPending && <Loader2Icon className="animate-spin" />}
                      Join workspace
                    </Button>
                  </FieldGroup>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">Passwords are hashed with bcrypt · sessions use signed JWTs</CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}
