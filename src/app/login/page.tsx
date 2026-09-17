"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BotIcon, GaugeIcon, Loader2Icon, RadioTowerIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useStore } from "@/lib/store"

const FEATURES = [
  { icon: RadioTowerIcon, title: "Live buying signals", body: "Intent, hiring, funding and web visits unified per account." },
  { icon: GaugeIcon, title: "Fit + intent scoring", body: "Your ICP, your weights — every account re-scored in real time." },
  { icon: BotIcon, title: "Orchestration agent", body: "Routes, drafts and enrolls automatically with human approval." },
]

export default function LoginPage() {
  const router = useRouter()
  const login = useStore((s) => s.login)
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const [email, setEmail] = useState("jordan@acmegrowth.com")
  const [password, setPassword] = useState("demo-password")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard")
  }, [isAuthenticated, router])

  const submit = (e: React.FormEvent, mode: "login" | "signup") => {
    e.preventDefault()
    if (!email.includes("@") || password.length < 6) {
      toast.error("Enter a valid email and a password of at least 6 characters")
      return
    }
    setLoading(true)
    setTimeout(() => {
      login(email)
      toast.success(mode === "login" ? "Welcome back" : "Workspace created", { description: "You're exploring the demo workspace." })
      router.replace("/dashboard")
    }, 700)
  }

  const sso = (provider: string) => {
    setLoading(true)
    setTimeout(() => {
      login("jordan@acmegrowth.com")
      toast.success(`Signed in with ${provider}`)
      router.replace("/dashboard")
    }, 700)
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
        <p className="text-sm text-primary-foreground/70">Demo workspace · all data is mocked and stored in your browser.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Welcome to SellEasy</CardTitle>
            <CardDescription>Sign in to your workspace or create a new one.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              {(["login", "signup"] as const).map((mode) => (
                <TabsContent key={mode} value={mode}>
                  <form onSubmit={(e) => submit(e, mode)}>
                    <FieldGroup>
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" disabled={loading} onClick={() => sso("Google")}>
                          Google
                        </Button>
                        <Button type="button" variant="outline" disabled={loading} onClick={() => sso("Microsoft")}>
                          Microsoft
                        </Button>
                      </div>
                      <FieldSeparator>or continue with email</FieldSeparator>
                      {mode === "signup" && (
                        <Field>
                          <FieldLabel htmlFor="company">Company name</FieldLabel>
                          <Input id="company" placeholder="Acme Growth Inc." />
                        </Field>
                      )}
                      <Field>
                        <FieldLabel htmlFor={`${mode}-email`}>Work email</FieldLabel>
                        <Input id={`${mode}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`${mode}-password`}>Password</FieldLabel>
                        <Input
                          id={`${mode}-password`}
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        {mode === "login" && <FieldDescription>Demo credentials are pre-filled.</FieldDescription>}
                      </Field>
                      <Button type="submit" disabled={loading} className="w-full">
                        {loading && <Loader2Icon className="animate-spin" />}
                        {mode === "login" ? "Sign in" : "Create workspace"}
                      </Button>
                    </FieldGroup>
                  </form>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">Secured by AWS Cognito (mocked)</CardFooter>
        </Card>
      </div>
    </div>
  )
}
