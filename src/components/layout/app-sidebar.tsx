"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronsUpDownIcon, LogOutIcon, MoonIcon, RotateCcwIcon, SunIcon, UserIcon, ZapIcon } from "lucide-react"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { UserAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { api, useAgentStats, useAuthStore, useCurrentUser, useInboxCounts, useMeta, useResetWorkspace, useSession, useSignalStats } from "@/lib/api"
import { ROLE_LABELS } from "@/lib/constants"
import { NAV_GROUPS } from "./nav"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const qc = useQueryClient()
  const { resolvedTheme, setTheme } = useTheme()
  const user = useCurrentUser()
  const { org } = useSession()
  const clear = useAuthStore((s) => s.clear)
  const meta = useMeta()
  const agentStats = useAgentStats()
  const inbox = useInboxCounts()
  const signalStats = useSignalStats()
  const reset = useResetWorkspace()
  const [resetOpen, setResetOpen] = useState(false)

  const badges: Record<string, number> = {
    "/agent": agentStats.data?.awaitingApproval ?? 0,
    "/outreach": inbox.data?.unread ?? 0,
    "/signals": signalStats.data?.unprocessed ?? 0,
  }

  const logout = () => {
    void api.post("/auth/logout").catch(() => undefined)
    clear()
    qc.clear()
    router.replace("/login")
  }

  const canReset = user.role === "owner" && meta.data?.features.adminReset

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ZapIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">SellEasy</span>
                  <span className="truncate text-xs text-muted-foreground">{org?.name}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const badge = badges[item.href]
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {badge > 0 && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <UserAvatar user={user} className="size-8 rounded-lg" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {ROLE_LABELS[user.role]} · {org?.name}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/settings")}>
                  <UserIcon /> Profile & settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                  {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
                  {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                {canReset && (
                  <DropdownMenuItem onSelect={() => setResetOpen(true)}>
                    <RotateCcwIcon /> Load demo data
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={logout}>
                  <LogOutIcon /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Replace workspace data with the demo dataset?"
        description="All accounts, contacts, signals, deals and sequences in this workspace are deleted and replaced with sample data. Users and API keys are kept. (Development only.)"
        confirmLabel="Load demo data"
        onConfirm={() => reset.mutate({ demo: true })}
      />
    </Sidebar>
  )
}
