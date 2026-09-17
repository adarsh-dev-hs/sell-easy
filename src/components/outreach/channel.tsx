import {
  ClockIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  PhoneIcon,
  UserPlusIcon,
} from "lucide-react"
import { STEP_CHANNEL_LABELS } from "@/lib/constants"
import type { InboxMessage, StepChannel } from "@/lib/types"
import { cn } from "@/lib/utils"

export const STEP_CHANNEL_ICONS: Record<StepChannel, LucideIcon> = {
  email: MailIcon,
  linkedin_connect: UserPlusIcon,
  linkedin_message: MessageSquareIcon,
  call: PhoneIcon,
  wait: ClockIcon,
}

const STEP_CHANNEL_COLORS: Record<StepChannel, string> = {
  email: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  linkedin_connect: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  linkedin_message: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  call: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  wait: "bg-muted text-muted-foreground",
}

export const STEP_CHANNEL_DESCRIPTIONS: Record<StepChannel, string> = {
  email: "Automated email sent from a rotating mailbox.",
  linkedin_connect: "Send a LinkedIn connection request via the LinkedIn outreach integration.",
  linkedin_message: "Send a LinkedIn direct message once connected.",
  call: "Creates a call task for the sequence owner with talking points from the account research.",
  wait: "Pause the sequence before moving to the next step.",
}

export function StepChannelIcon({ channel, className }: { channel: StepChannel; className?: string }) {
  const Icon = STEP_CHANNEL_ICONS[channel]
  return (
    <div
      title={STEP_CHANNEL_LABELS[channel]}
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", STEP_CHANNEL_COLORS[channel], className)}
    >
      <Icon className="size-4" />
    </div>
  )
}

export function MessageChannelIcon({ channel, className }: { channel: InboxMessage["channel"]; className?: string }) {
  if (channel === "linkedin") {
    return (
      <span
        aria-label="LinkedIn"
        title="LinkedIn"
        className={cn(
          "inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] bg-sky-700 text-[8px] leading-none font-bold text-white",
          className,
        )}
      >
        in
      </span>
    )
  }
  return <MailIcon aria-label="Email" className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />
}

export const SENTIMENT_LABELS: Record<InboxMessage["sentiment"], string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  ooo: "Out of office",
}

export const rate = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)

export const VARIABLES = ["{{first_name}}", "{{company}}", "{{sender_name}}", "{{similar_customer}}", "{{funding_round}}"]

export function fillTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => vars[key] ?? m)
}
