"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronsUpDownIcon, LogOutIcon, MoonIcon, RotateCcwIcon, SunIcon, UserIcon, ZapIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
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
import { ROLE_LABELS } from "@/lib/constants"
import { useCurrentUser, useStore } from "@/lib/store"
import { NAV_GROUPS } from "./nav"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const user = useCurrentUser()
  const org = useStore((s) => s.org)
  const logout = useStore((s) => s.logout)
  const resetDemo = useStore((s) => s.resetDemo)
  const pendingDrafts = useStore((s) => s.drafts.filter((d) => d.status === "pending").length)
  const unreadReplies = useStore((s) => s.inbox.filter((m) => !m.read && !m.archived).length)
  const unprocessed = useStore((s) => s.signals.filter((x) => !x.processed).length)

  const badges: Record<string, number> = {
    "/agent": pendingDrafts,
    "/outreach": unreadReplies,
    "/signals": unprocessed,
  }

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
                  <span className="truncate text-xs text-muted-foreground">{org.name}</span>
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
                    {ROLE_LABELS[user.role]} · {org.name}
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
                <DropdownMenuItem
                  onSelect={() => {
                    resetDemo()
                    toast.success("Demo data reset")
                  }}
                >
                  <RotateCcwIcon /> Reset demo data
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    logout()
                    router.replace("/login")
                  }}
                >
                  <LogOutIcon /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
