"use client"

import {
  BotIcon,
  CalendarIcon,
  GitCommitHorizontalIcon,
  MailIcon,
  PhoneIcon,
  RadioTowerIcon,
  SparklesIcon,
  StickyNoteIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"
import { AgentAvatar, UserAvatar } from "@/components/shared/avatars"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { dateTime, timeAgo } from "@/lib/format"
import { useUsers } from "@/lib/api"
import type { Activity } from "@/lib/types"

const TYPE_ICONS: Record<Activity["type"], LucideIcon> = {
  note: StickyNoteIcon,
  email: MailIcon,
  call: PhoneIcon,
  meeting: CalendarIcon,
  stage_change: GitCommitHorizontalIcon,
  enrichment: SparklesIcon,
  score_change: TrendingUpIcon,
  agent: BotIcon,
  signal: RadioTowerIcon,
}

export function ActorLabel({ actorId }: { actorId?: Activity["actorId"] }) {
  const { data: users } = useUsers()
  if (actorId === "agent")
    return (
      <span className="inline-flex items-center gap-1.5">
        <AgentAvatar className="size-5" />
        <span>Agent</span>
      </span>
    )
  const user = actorId && actorId !== "system" ? users?.find((u) => u.id === actorId) : undefined
  if (!user)
    return (
      <span className="inline-flex items-center gap-1.5">
        <Avatar className="size-5">
          <AvatarFallback className="text-[9px]">SYS</AvatarFallback>
        </Avatar>
        <span>System</span>
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5">
      <UserAvatar user={user} className="size-5" />
      <span>{user.name}</span>
    </span>
  )
}

/** Renders a list of activities (fetched by the caller). Actor names are resolved from the team list. */
export function ActivityTimeline({ items, emptyText = "No activity yet." }: { items: Activity[]; emptyText?: string }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-border">
      {items.map((a) => {
        const Icon = TYPE_ICONS[a.type] ?? StickyNoteIcon
        return (
          <li key={a.id} className="relative flex gap-3">
            <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-medium">{a.title}</span>
                <span className="text-xs text-muted-foreground" title={dateTime(a.at)}>
                  {timeAgo(a.at)}
                </span>
              </div>
              {a.detail && <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{a.detail}</p>}
              <div className="mt-1.5 text-xs text-muted-foreground">
                <ActorLabel actorId={a.actorId} />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
