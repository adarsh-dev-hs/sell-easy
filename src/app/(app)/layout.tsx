"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { useStore } from "@/lib/store"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login")
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

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
