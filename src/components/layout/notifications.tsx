"use client"

import { useRouter } from "next/navigation"
import { BellIcon, BotIcon, CheckCheckIcon, KanbanSquareIcon, MailIcon, RadioTowerIcon, SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { timeAgo } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { AppNotification } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<AppNotification["kind"], typeof BellIcon> = {
  agent: BotIcon,
  reply: MailIcon,
  signal: RadioTowerIcon,
  deal: KanbanSquareIcon,
  system: SettingsIcon,
}

export function Notifications() {
  const router = useRouter()
  const notifications = useStore((s) => s.notifications)
  const markRead = useStore((s) => s.markNotificationRead)
  const markAll = useStore((s) => s.markAllNotificationsRead)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <BellIcon />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-medium">Notifications</div>
          <Button variant="ghost" size="xs" onClick={markAll} disabled={!unread}>
            <CheckCheckIcon /> Mark all read
          </Button>
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {notifications.map((n) => {
            const Icon = ICONS[n.kind]
            return (
              <button
                key={n.id}
                className={cn("flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/60", !n.read && "bg-primary/5")}
                onClick={() => {
                  markRead(n.id)
                  if (n.href) router.push(n.href)
                }}
              >
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{n.title}</span>
                    {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <p className="text-[11px] text-muted-foreground">{timeAgo(n.at)}</p>
                </div>
              </button>
            )
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
