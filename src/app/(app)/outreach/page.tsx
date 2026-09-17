"use client"

import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { InboxIcon, MailIcon, WorkflowIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InboxTab } from "@/components/outreach/inbox-tab"
import { MailboxesTab } from "@/components/outreach/mailboxes-tab"
import { SequencesTab } from "@/components/outreach/sequences-tab"
import { PageHeader } from "@/components/shared/page-header"
import { useStore } from "@/lib/store"

const TABS = ["sequences", "inbox", "mailboxes"] as const
type Tab = (typeof TABS)[number]

function OutreachInner() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const raw = params.get("tab")
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "sequences"
  const unread = useStore((s) => s.inbox.reduce((n, m) => n + (!m.read && !m.archived ? 1 : 0), 0))

  const setTab = (value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set("tab", value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Multi-channel sequences, reply capture and mailbox deliverability."
      />
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="sequences">
            <WorkflowIcon /> Sequences
          </TabsTrigger>
          <TabsTrigger value="inbox">
            <InboxIcon /> Inbox
            {unread > 0 && (
              <Badge className="h-4 min-w-4 rounded-full px-1 text-[10px] tabular-nums">{unread}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mailboxes">
            <MailIcon /> Mailboxes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sequences">
          <SequencesTab />
        </TabsContent>
        <TabsContent value="inbox">
          <InboxTab />
        </TabsContent>
        <TabsContent value="mailboxes">
          <MailboxesTab />
        </TabsContent>
      </Tabs>
    </>
  )
}

export default function OutreachPage() {
  return (
    <Suspense>
      <OutreachInner />
    </Suspense>
  )
}
