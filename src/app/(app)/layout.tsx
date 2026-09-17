"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangleIcon, Loader2Icon, RotateCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { errorMessage, useMe, useSession } from "@/lib/api"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, user } = useSession()
  const me = useMe()

  useEffect(() => {
    if (!isAuthenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [isAuthenticated, router, pathname])

  if (!isAuthenticated) return null

  if (!user) {
    if (me.isError) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangleIcon className="size-6 text-destructive" />
          <p className="max-w-md text-sm text-muted-foreground">{errorMessage(me.error)}</p>
          <Button variant="outline" onClick={() => me.refetch()}>
            <RotateCwIcon /> Retry
          </Button>
        </div>
      )
    }
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 space-y-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
