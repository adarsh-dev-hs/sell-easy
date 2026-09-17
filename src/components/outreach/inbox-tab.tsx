"use client"

import { useState } from "react"
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
  SearchIcon,
  SendIcon,
  SparklesIcon,
  WorkflowIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PersonAvatar } from "@/components/shared/avatars"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryError } from "@/components/shared/query-state"
import { StatusBadge } from "@/components/shared/status"
import { dateTime, fullName, timeAgo } from "@/lib/format"
import {
  canWrite,
  type InboxRecord,
  useBookMeeting,
  useCurrentUser,
  useInbox,
  useInboxCounts,
  useInboxMessage,
  useReplyToMessage,
  useSuggestReply,
  useUpdateMessage,
} from "@/lib/api"
import type { InboxMessage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MessageChannelIcon, SENTIMENT_LABELS } from "./channel"
import { useDebounced } from "./use-debounced"

type SentimentFilter = "all" | InboxMessage["sentiment"]

const contactName = (m: Pick<InboxRecord, "contact"> | null | undefined) => (m?.contact ? fullName(m.contact) : undefined)

export function InboxTab() {
  const router = useRouter()
  const me = useCurrentUser()
  const writable = canWrite(me.role)
  const updateMessage = useUpdateMessage()
  const replyToMessage = useReplyToMessage()
  const suggestReply = useSuggestReply()
  const bookMeeting = useBookMeeting()

  const [sentiment, setSentiment] = useState<SentimentFilter>("all")
  const [showArchived, setShowArchived] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const q = useDebounced(query.trim())

  const countsQuery = useInboxCounts(showArchived)
  const counts = countsQuery.data
  const inbox = useInbox({
    sentiment: sentiment === "all" ? undefined : [sentiment],
    archived: showArchived || undefined,
    q: q || undefined,
    pageSize: 50,
  })
  const list = inbox.data?.data ?? []

  // Prefer the list row (kept fresh by invalidation); fall back to fetching it if it's filtered out.
  const listed = list.find((m) => m.id === selectedId)
  const detail = useInboxMessage(selectedId, !listed)
  const selected = listed ?? (selectedId ? detail.data : undefined) ?? null
  const contact = selected?.contact ?? null
  const account = selected?.account ?? null
  const draft = selected ? (drafts[selected.id] ?? "") : ""

  const select = (m: InboxRecord) => {
    setSelectedId(m.id)
    if (!m.read && writable) updateMessage.mutate({ id: m.id, read: true })
  }

  const setDraft = (value: string) => {
    if (!selected) return
    setDrafts((d) => ({ ...d, [selected.id]: value }))
  }

  const suggest = () => {
    if (!selected) return
    const { id, sentiment: s } = selected
    suggestReply.mutate(id, {
      onSuccess: ({ body }) => {
        setDrafts((d) => ({ ...d, [id]: body }))
        toast.success("Reply drafted", { description: `Tailored for a ${SENTIMENT_LABELS[s].toLowerCase()} reply` })
      },
    })
  }

  const send = () => {
    if (!selected || !draft.trim() || replyToMessage.isPending) return
    const id = selected.id
    replyToMessage.mutate({ id, body: draft.trim() }, { onSuccess: () => setDrafts((d) => ({ ...d, [id]: "" })) })
  }

  const book = () => {
    if (!selected) return
    const name = contactName(selected) ?? "Contact"
    bookMeeting.mutate(selected.id, {
      onSuccess: ({ deal, created }) =>
        toast.success("Meeting booked", {
          description: `${name} marked as meeting · deal ${created ? "created" : "updated"}`,
          action: { label: "View deal", onClick: () => router.push(`/pipeline?deal=${deal.id}`) },
        }),
    })
  }

  const toggleArchive = () => {
    if (!selected) return
    const archived = !selected.archived
    updateMessage.mutate(
      { id: selected.id, archived },
      { onSuccess: () => toast.success(archived ? "Conversation archived" : "Conversation restored") },
    )
    if (archived && !showArchived) setSelectedId(null)
  }

  const markUnread = () => {
    if (!selected) return
    updateMessage.mutate({ id: selected.id, read: false }, { onSuccess: () => toast.success("Marked as unread") })
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
                {counts && <span className="text-xs text-muted-foreground tabular-nums">{counts[s]}</span>}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <InputGroup className="sm:w-60">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search replies…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </InputGroup>
          <Label className="flex shrink-0 items-center gap-2 font-normal">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            Show archived
          </Label>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0 lg:grid lg:h-[calc(100svh-17rem)] lg:min-h-[520px] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* List */}
        <div className={cn("min-h-0 flex-col lg:flex lg:border-r", selected ? "hidden" : "flex")}>
          <ScrollArea className="h-[60svh] lg:h-full">
            {inbox.isError ? (
              <div className="p-4">
                <QueryError error={inbox.error} onRetry={() => inbox.refetch()} />
              </div>
            ) : inbox.isPending ? (
              <ul className="divide-y">
                {Array.from({ length: 7 }).map((_, i) => (
                  <li key={i} className="flex gap-3 px-4 py-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : list.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={InboxIcon} title="No conversations" description="Nothing matches this filter yet." />
              </div>
            ) : (
              <ul className="divide-y">
                {list.map((m) => {
                  const c = m.contact
                  const a = m.account
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
              {selectedId && detail.isPending ? (
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <EmptyState
                  icon={MailIcon}
                  title="Select a conversation"
                  description="Pick a reply on the left to read the thread and respond."
                />
              )}
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
                  {!writable ? (
                    <StatusBadge status={selected.sentiment} label={SENTIMENT_LABELS[selected.sentiment]} />
                  ) : (
                    <Select
                      value={selected.sentiment}
                      onValueChange={(v) => {
                        const next = v as InboxMessage["sentiment"]
                        updateMessage.mutate(
                          { id: selected.id, sentiment: next },
                          { onSuccess: () => toast.success("Sentiment updated", { description: SENTIMENT_LABELS[next] }) },
                        )
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
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{selected.subject}</span>
                  {selected.sequenceId && selected.sequenceName && (
                    <Link
                      href={`/outreach/${selected.sequenceId}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <WorkflowIcon className="size-3.5" /> {selected.sequenceName}
                    </Link>
                  )}
                  {selected.archived && <StatusBadge status="archived" label="Archived" />}
                </div>
                {writable && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={book} disabled={bookMeeting.isPending}>
                      {bookMeeting.isPending ? <Loader2Icon className="animate-spin" /> : <CalendarPlusIcon />} Book meeting
                    </Button>
                    <Button size="sm" variant="outline" onClick={toggleArchive}>
                      {selected.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                      {selected.archived ? "Unarchive" : "Archive"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={markUnread}>
                      <MailIcon /> Mark unread
                    </Button>
                  </div>
                )}
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

              {writable && (
                <>
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
                      <Button variant="outline" size="sm" onClick={suggest} disabled={suggestReply.isPending}>
                        {suggestReply.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                        {suggestReply.isPending ? "Drafting…" : "AI suggest"}
                      </Button>
                      <div className="flex items-center gap-2">
                        <span className="hidden text-xs text-muted-foreground sm:inline">⌘ + Enter</span>
                        <Button size="sm" onClick={send} disabled={!draft.trim() || replyToMessage.isPending}>
                          {replyToMessage.isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
