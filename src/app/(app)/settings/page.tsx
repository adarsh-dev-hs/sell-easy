"use client"

import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BellIcon, Building2Icon, KeyRoundIcon, PaletteIcon, UserIcon, UsersIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { ApiKeysTab } from "@/components/settings/api-keys-tab"
import { AppearanceTab } from "@/components/settings/appearance-tab"
import { NotificationsTab } from "@/components/settings/notifications-tab"
import { OrganizationTab } from "@/components/settings/organization-tab"
import { ProfileTab } from "@/components/settings/profile-tab"
import { TeamTab } from "@/components/settings/team-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isAdmin, useCurrentUser } from "@/lib/api"

const TABS = [
  { value: "profile", label: "Profile", icon: UserIcon, Component: ProfileTab },
  { value: "organization", label: "Organization", icon: Building2Icon, Component: OrganizationTab },
  { value: "team", label: "Team", icon: UsersIcon, Component: TeamTab },
  { value: "api-keys", label: "API keys", icon: KeyRoundIcon, Component: ApiKeysTab, adminOnly: true },
  { value: "notifications", label: "Notifications", icon: BellIcon, Component: NotificationsTab },
  { value: "appearance", label: "Appearance", icon: PaletteIcon, Component: AppearanceTab },
] as const

type TabValue = (typeof TABS)[number]["value"]

function SettingsInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const user = useCurrentUser()
  const tabs = TABS.filter((t) => !("adminOnly" in t && t.adminOnly) || isAdmin(user.role))
  const param = searchParams.get("tab")
  const tab: TabValue = tabs.some((t) => t.value === param) ? (param as TabValue) : "profile"

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "profile") params.delete("tab")
    else params.set("tab", value)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, workspace, team access and API credentials." />
      <Tabs value={tab} onValueChange={onTabChange} className="gap-6">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="px-2.5">
                <t.icon /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="max-w-5xl">
            <t.Component />
          </TabsContent>
        ))}
      </Tabs>
    </>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  )
}
