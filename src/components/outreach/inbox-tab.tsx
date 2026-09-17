"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  CalendarPlusIcon,
  InboxIcon,
  Loader2Icon,
  MailIcon,
  SendIcon,
  SparklesIcon,
  WorkflowIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PersonAvatar } from "@/components/shared/avatars"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status"
import { dateTime, fullName, timeAgo } from "@/lib/format"
import { useCurrentUser, useLookup, useStore } from "@/lib/store"
import type { InboxMessage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MessageChannelIcon, SENTIMENT_LABELS } from "./channel"

type SentimentFilter = "all" | InboxMessage["sentiment"]

const SUGGESTIONS: Record<InboxMessage["sentiment"], (v: { first: string; company: string; sender: string }) => string> = {
  positive: ({ first, company, sender }) =>
    `Hi ${first},\n\nGreat to hear from you — thanks for getting back to me. I'd love to walk you through how teams like ${company} are turning intent signals into booked meetings.\n\nDoes Thursday at 2pm or Friday at 10am work? Happy to send an invite for whichever suits.\n\nBest,\n${sender}`,
  neutral: ({ first, company, sender }) =>
    `Hi ${first},\n\nThanks for the quick reply — really appreciate it. Would you mind pointing me to the right person on the ${company} revenue team? I'll keep it brief and mention you sent me their way.\n\nThanks again,\n${sender}`,
  negative: ({ first, sender }) =>
    `Hi ${first},\n\nUnderstood — I've removed you from our outreach and you won't hear from me again. Apologies for the interruption.\n\nAll the best,\n${sender}`,
  ooo: ({ first, sender }) =>
    `Hi ${first},\n\nNo rush at all — enjoy your time away. I'll follow up once you're back next week.\n\nBest,\n${sender}`,
}

export function InboxTab() {
  const router = useRouter()
  const inbox = useStore((s) => s.inbox)
  const markMessage = useStore((s) => s.markMessage)
  const replyToMessage = useStore((s) => s.replyToMessage)
  const bookMeeting = useStore((s) => s.bookMeeting)
  const lookup = useLookup()
  const me = useCurrentUser()

  const [sentiment, setSentiment] = useState<SentimentFilter>("all")
  const [showArchived, setShowArchived] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [suggesting, setSuggesting] = useState(false)

  const counts = useMemo(() => {
    const visible = inbox.filter((m) => showArchived || !m.archived)
    const c: Record<SentimentFilter, number> = { all: visible.length, positive: 0, neutral: 0, negative: 0, ooo: 0 }
    for (const m of visible) c[m.sentiment]++
    return c
  }, [inbox, showArchived])

  const list = useMemo(
    () =>
      inbox
        .filter((m) => (showArchived || !m.archived) && (sentiment === "all" || m.sentiment === sentiment))
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [inbox, showArchived, sentiment],
  )

  const selected = useMemo(() => inbox.find((m) => m.id === selectedId) ?? null, [inbox, selectedId])
  const contact = lookup.contact(selected?.contactId)
  const account = lookup.account(contact?.accountId)
  const sequence = lookup.sequence(selected?.sequenceId)
  const draft = selected ? (drafts[selected.id] ?? "") : ""

  const select = (m: InboxMessage) => {
    setSelectedId(m.id)
    if (!m.read) markMessage(m.id, { read: true })
  }

  const setDraft = (value: string) => {
    if (!selected) return
    setDrafts((d) => ({ ...d, [selected.id]: value }))
  }

  const suggest = () => {
    if (!selected) return
    const id = selected.id
    const text = SUGGESTIONS[selected.sentiment]({
      first: contact?.firstName ?? "there",
      company: account?.name ?? "your team",
      sender: me.name.split(" ")[0],
    })
    setSuggesting(true)
    setTimeout(() => {
      setDrafts((d) => ({ ...d, [id]: text }))
      setSuggesting(false)
      toast.success("Reply drafted", { description: `Tailored for a ${SENTIMENT_LABELS[selected.sentiment].toLowerCase()} reply` })
    }, 900)
  }

  const send = () => {
    if (!selected || !draft.trim()) return
    replyToMessage(selected.id, draft.trim())
    setDrafts((d) => ({ ...d, [selected.id]: "" }))
    toast.success("Reply sent", { description: `To ${contact ? fullName(contact) : "contact"}` })
  }

  const book = () => {
    if (!selected) return
    const dealId = bookMeeting(selected.id)
    if (!dealId) {
      toast.error("Could not book meeting", { description: "Contact not found" })
      return
    }
    if (selected.sentiment !== "positive") markMessage(selected.id, { sentiment: "positive" })
    toast.success("Meeting booked", {
      description: `${contact ? fullName(contact) : "Contact"} marked as meeting · deal updated`,
      action: { label: "View deal", onClick: () => router.push(`/pipeline?deal=${dealId}`) },
    })
  }

  const toggleArchive = () => {
    if (!selected) return
    const archived = !selected.archived
    markMessage(selected.id, { archived })
    toast.success(archived ? "Conversation archived" : "Conversation restored")
    if (archived && !showArchived) setSelectedId(null)
  }

  const markUnread = () => {
    if (!selected) return
    markMessage(selected.id, { read: false })
    toast.success("Marked as unread")
    setSelectedId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={sentiment}
            onValueChange={(v) => v && setSentiment(v as SentimentFilter)}
          >
            {(["all", "positive", "neutral", "negative", "ooo"] as const).map((s) => (
              <ToggleGroupItem key={s} value={s} className="px-3">
                {s === "all" ? "All" : s === "ooo" ? "OOO" : SENTIMENT_LABELS[s]}
                <span className="text-xs text-muted-foreground tabular-nums">{counts[s]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Label className="flex items-center gap-2 font-normal">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          Show archived
        </Label>
      </div>

      <Card className="gap-0 overflow-hidden py-0 lg:grid lg:h-[calc(100svh-17rem)] lg:min-h-[520px] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* List */}
        <div className={cn("min-h-0 flex-col lg:flex lg:border-r", selected ? "hidden" : "flex")}>
          <ScrollArea className="h-[60svh] lg:h-full">
            {list.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={InboxIcon} title="No conversations" description="Nothing matches this filter yet." />
              </div>
            ) : (
              <ul className="divide-y">
                {list.map((m) => {
                  const c = lookup.contact(m.contactId)
                  const a = lookup.account(c?.accountId)
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => select(m)}
                        className={cn(
                          "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                          selectedId === m.id && "bg-muted",
                          m.archived && "opacity-60",
                        )}
                      >
                        <div className="relative">
                          <PersonAvatar name={c ? fullName(c) : "Unknown"} />
                          {!m.read && <span className="absolute -top-0.5 -left-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card" />}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={cn("truncate text-sm", !m.read ? "font-semibold" : "font-medium")}>
                              {c ? fullName(c) : "Unknown contact"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{a?.name}</span>
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(m.receivedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageChannelIcon channel={m.channel} />
                            <span className={cn("truncate text-sm", !m.read && "font-medium")}>{m.subject}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs text-muted-foreground">{m.snippet}</span>
                            <StatusBadge status={m.sentiment} label={SENTIMENT_LABELS[m.sentiment]} className="ml-auto shrink-0" />
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Thread */}
        <div className={cn("min-h-0 flex-col lg:flex", selected ? "flex" : "hidden")}>
          {!selected ? (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState icon={MailIcon} title="Select a conversation" description="Pick a reply on the left to read the thread and respond." />
            </div>
          ) : (
            <>
              <div className="space-y-3 border-b p-4">
                <div className="flex items-start gap-3">
                  <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setSelectedId(null)} aria-label="Back to inbox">
                    <ArrowLeftIcon />
                  </Button>
                  <PersonAvatar name={contact ? fullName(contact) : "Unknown"} className="size-10" />
                  <div className="min-w-0 flex-1">
                    {contact ? (
                      <Link href={`/contacts?id=${contact.id}`} className="block truncate font-medium hover:underline">
                        {fullName(contact)}
                      </Link>
                    ) : (
                      <span className="font-medium">Unknown contact</span>
                    )}
                    <div className="truncate text-sm text-muted-foreground">
                      {contact?.title}
                      {account && (
                        <>
                          {" · "}
                          <Link href={`/accounts/${account.id}`} className="hover:text-foreground hover:underline">
                            {account.name}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  <Select
                    value={selected.sentiment}
                    onValueChange={(v) => {
                      markMessage(selected.id, { sentiment: v as InboxMessage["sentiment"] })
                      toast.success("Sentiment updated", { description: SENTIMENT_LABELS[v as InboxMessage["sentiment"]] })
                    }}
                  >
                    <SelectTrigger size="sm" className="w-36" aria-label="Sentiment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {(Object.keys(SENTIMENT_LABELS) as InboxMessage["sentiment"][]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {SENTIMENT_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{selected.subject}</span>
                  {sequence && (
                    <Link href={`/outreach/${sequence.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <WorkflowIcon className="size-3.5" /> {sequence.name}
                    </Link>
                  )}
                  {selected.archived && <StatusBadge status="archived" label="Archived" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={book}>
                    <CalendarPlusIcon /> Book meeting
                  </Button>
                  <Button size="sm" variant="outline" onClick={toggleArchive}>
                    {selected.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                    {selected.archived ? "Unarchive" : "Archive"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={markUnread}>
                    <MailIcon /> Mark unread
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[45svh] min-h-0 flex-1 lg:h-auto">
                <div className="space-y-4 p-4">
                  {selected.thread.map((t, i) => {
                    const ours = t.from === "us"
                    return (
                      <div key={i} className={cn("flex flex-col gap-1", ours ? "items-end" : "items-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                            ours ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                          )}
                        >
                          {t.body}
                        </div>
                        <span className="px-1 text-xs text-muted-foreground">
                          {ours ? "You" : contact?.firstName ?? "Them"} · {dateTime(t.at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              <Separator />
              <div className="space-y-2 p-4">
                <Textarea
                  placeholder={`Reply to ${contact?.firstName ?? "contact"}…`}
                  className="max-h-48 min-h-24"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send()
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={suggest} disabled={suggesting}>
                    {suggesting ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                    {suggesting ? "Drafting…" : "AI suggest"}
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs text-muted-foreground sm:inline">⌘ + Enter</span>
                    <Button size="sm" onClick={send} disabled={!draft.trim()}>
                      <SendIcon /> Send reply
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
