"use client"

import { useEffect, useState } from "react"
import { ThemeProvider } from "next-themes"
import { Loader2Icon } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { useStore } from "@/lib/store"

/** Rehydrates the persisted mock backend before rendering anything that reads it. */
function HydrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.resolve(useStore.persist.rehydrate()).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    )
  }
  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        <HydrationGate>{children}</HydrationGate>
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
