import {
  BarChart3Icon,
  BotIcon,
  Building2Icon,
  GaugeIcon,
  KanbanSquareIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PlugIcon,
  RadioTowerIcon,
  SendIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  service: string
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon, service: "Analytics" }],
  },
  {
    label: "Data",
    items: [
      { title: "Accounts", href: "/accounts", icon: Building2Icon, service: "Entity service" },
      { title: "Contacts", href: "/contacts", icon: UsersIcon, service: "Entity service" },
      { title: "Signals", href: "/signals", icon: RadioTowerIcon, service: "Signal ingestion" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "ICP & Scoring", href: "/scoring", icon: GaugeIcon, service: "ICP/Scoring service" },
      { title: "Agent", href: "/agent", icon: BotIcon, service: "Orchestration agent" },
    ],
  },
  {
    label: "Engage",
    items: [
      { title: "Outreach", href: "/outreach", icon: SendIcon, service: "Outreach service" },
      { title: "Pipeline", href: "/pipeline", icon: KanbanSquareIcon, service: "CRM/Pipeline service" },
      { title: "Analytics", href: "/analytics", icon: BarChart3Icon, service: "Analytics service" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Integrations", href: "/integrations", icon: PlugIcon, service: "Third-party vendors" },
      { title: "Settings", href: "/settings", icon: SettingsIcon, service: "Auth service" },
    ],
  },
]

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items)
