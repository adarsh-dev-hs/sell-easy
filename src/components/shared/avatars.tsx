import { BotIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initials } from "@/lib/format"
import type { User } from "@/lib/types"
import { cn } from "@/lib/utils"

const PALETTE = [
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
]

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function CompanyAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
        PALETTE[hash(name) % PALETTE.length],
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}

export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback className={cn("text-xs font-medium", PALETTE[hash(name) % PALETTE.length])}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

export function UserAvatar({ user, className }: { user?: Pick<User, "name" | "avatarColor"> | null; className?: string }) {
  if (!user) {
    return (
      <Avatar className={cn("size-6", className)}>
        <AvatarFallback className="text-[10px]">?</AvatarFallback>
      </Avatar>
    )
  }
  return (
    <Avatar className={cn("size-6", className)}>
      <AvatarFallback className={cn("text-[10px] font-medium text-white", user.avatarColor)}>{initials(user.name)}</AvatarFallback>
    </Avatar>
  )
}

export function AgentAvatar({ className }: { className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      <AvatarFallback className="bg-primary text-primary-foreground">
        <BotIcon className="size-3.5" />
      </AvatarFallback>
    </Avatar>
  )
}

export function OwnerLabel({ user }: { user?: Pick<User, "name" | "avatarColor"> | null }) {
  return (
    <div className="flex items-center gap-2">
      <UserAvatar user={user} />
      <span className={cn("truncate text-sm", !user && "text-muted-foreground")}>{user?.name ?? "Unassigned"}</span>
    </div>
  )
}
