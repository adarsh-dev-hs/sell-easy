import {
  BriefcaseIcon,
  DollarSignIcon,
  EyeIcon,
  GlobeIcon,
  type LucideIcon,
  MessageCircleIcon,
  NewspaperIcon,
  ServerIcon,
  TrendingUpIcon,
  UserRoundPlusIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { SignalType } from "@/lib/types"
import { cn } from "@/lib/utils"

export type Tone = "neutral" | "success" | "info" | "warning" | "danger" | "primary"

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-transparent",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent",
  danger: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-transparent",
  primary: "bg-primary/15 text-primary border-transparent",
}

const STATUS_TONE: Record<string, Tone> = {
  // generic
  active: "success",
  healthy: "success",
  ok: "success",
  completed: "success",
  done: "success",
  verified: "success",
  sent: "success",
  approved: "success",
  replied: "primary",
  meeting: "success",
  customer: "success",
  closed_won: "success",
  positive: "success",
  // in-progress
  in_sequence: "info",
  engaged: "info",
  researching: "info",
  syncing: "info",
  opportunity: "primary",
  awaiting_approval: "warning",
  pending: "warning",
  warning: "warning",
  paused: "warning",
  unverified: "warning",
  invited: "warning",
  ooo: "warning",
  draft: "neutral",
  new: "neutral",
  neutral: "neutral",
  skipped: "neutral",
  missing: "neutral",
  disconnected: "neutral",
  // bad
  failed: "danger",
  error: "danger",
  invalid: "danger",
  bounced: "danger",
  unsubscribed: "danger",
  rejected: "danger",
  disqualified: "danger",
  closed_lost: "danger",
  negative: "danger",
}

export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: string
  label?: string
  tone?: Tone
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(TONES[tone ?? STATUS_TONE[status] ?? "neutral"], className)}>
      {label ?? humanize(status)}
    </Badge>
  )
}

export const SIGNAL_ICONS: Record<SignalType, LucideIcon> = {
  intent_topic: TrendingUpIcon,
  website_visit: EyeIcon,
  hiring: BriefcaseIcon,
  funding: DollarSignIcon,
  job_change: UserRoundPlusIcon,
  tech_install: ServerIcon,
  social_engagement: MessageCircleIcon,
  news: NewspaperIcon,
}

const SIGNAL_COLORS: Record<SignalType, string> = {
  intent_topic: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  website_visit: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  hiring: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  funding: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  job_change: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  tech_install: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  social_engagement: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  news: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
}

export function SignalIcon({ type, className }: { type: SignalType; className?: string }) {
  const Icon = SIGNAL_ICONS[type] ?? GlobeIcon
  return (
    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", SIGNAL_COLORS[type], className)}>
      <Icon className="size-4" />
    </div>
  )
}
