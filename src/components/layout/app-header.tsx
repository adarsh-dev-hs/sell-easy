"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { RadioTowerIcon } from "lucide-react"
import { toast } from "sonner"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useStore } from "@/lib/store"
import { CommandMenu } from "./command-menu"
import { ALL_NAV } from "./nav"
import { Notifications } from "./notifications"

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const autopilot = useStore((s) => s.autopilot)
  const setAutopilot = useStore((s) => s.setAutopilot)
  const simulateSignal = useStore((s) => s.simulateSignal)
  const accounts = useStore((s) => s.accounts)
  const sequences = useStore((s) => s.sequences)

  const [, section, id] = pathname.split("/")
  const nav = ALL_NAV.find((n) => n.href === `/${section}`)
  const detailLabel =
    id && section === "accounts"
      ? accounts.find((a) => a.id === id)?.name
      : id && section === "outreach"
        ? sequences.find((q) => q.id === id)?.name
        : undefined

  const onSimulate = () => {
    const run = simulateSignal()
    const acc = run && accounts.find((a) => a.id === run.accountId)
    if (!run) {
      toast.info("Signal queued", { description: "Autopilot is off — process it from the Signals page." })
      return
    }
    toast.success(`Signal on ${acc?.name ?? "account"}`, {
      description: `${run.trigger} · agent ${run.status.replace("_", " ")} · score ${run.scoreBefore} → ${run.scoreAfter}`,
      action: { label: "View run", onClick: () => router.push(`/agent?run=${run.id}`) },
    })
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            {detailLabel ? (
              <BreadcrumbLink asChild>
                <Link href={nav?.href ?? "/"}>{nav?.title}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{nav?.title ?? "SellEasy"}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {detailLabel && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-60 truncate">{detailLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:block">
          <CommandMenu />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="hidden items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium lg:flex">
              <span className={autopilot ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-muted-foreground/40"} />
              Autopilot
              <Switch size="sm" checked={autopilot} onCheckedChange={setAutopilot} />
            </label>
          </TooltipTrigger>
          <TooltipContent>When on, the orchestration agent processes every incoming signal automatically.</TooltipContent>
        </Tooltip>
        <Button size="sm" onClick={onSimulate}>
          <RadioTowerIcon />
          <span className="hidden sm:inline">Simulate signal</span>
        </Button>
        <Notifications />
      </div>
    </header>
  )
}
