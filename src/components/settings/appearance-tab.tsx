"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const

function Preview({ mode }: { mode: "light" | "dark" }) {
  const dark = mode === "dark"
  return (
    <div className={cn("flex h-full gap-1.5 p-2", dark ? "bg-zinc-950" : "bg-white")}>
      <div className={cn("w-1/4 space-y-1 rounded-sm p-1", dark ? "bg-zinc-900" : "bg-zinc-100")}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("h-1.5 rounded-full", dark ? "bg-zinc-700" : "bg-zinc-300")} />
        ))}
      </div>
      <div className="flex-1 space-y-1.5">
        <div className={cn("h-2 w-2/3 rounded-full", dark ? "bg-zinc-600" : "bg-zinc-300")} />
        <div className={cn("space-y-1 rounded-sm border p-1.5", dark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50")}>
          <div className={cn("h-1.5 w-full rounded-full", dark ? "bg-zinc-700" : "bg-zinc-200")} />
          <div className={cn("h-1.5 w-4/5 rounded-full", dark ? "bg-zinc-700" : "bg-zinc-200")} />
          <div className="h-1.5 w-1/3 rounded-full bg-indigo-500" />
        </div>
      </div>
    </div>
  )
}

export function AppearanceTab() {
  const { theme, setTheme } = useTheme()
  const current = theme ?? "system"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how SellEasy looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={current}
          onValueChange={(v) => {
            setTheme(v)
            toast.success(`Theme set to ${THEMES.find((t) => t.value === v)?.label ?? v}`)
          }}
          className="grid gap-3 sm:grid-cols-3"
        >
          {THEMES.map((t) => (
            <FieldLabel key={t.value} htmlFor={`theme-${t.value}`} className="overflow-hidden">
              <div className="aspect-[16/9] w-full border-b">
                {t.value === "system" ? (
                  <div className="grid h-full grid-cols-2">
                    <Preview mode="light" />
                    <Preview mode="dark" />
                  </div>
                ) : (
                  <Preview mode={t.value} />
                )}
              </div>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>
                    <t.icon className="size-4" /> {t.label}
                  </FieldTitle>
                </FieldContent>
                <RadioGroupItem value={t.value} id={`theme-${t.value}`} />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}
