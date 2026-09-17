"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2Icon, KanbanSquareIcon, RadioTowerIcon, SearchIcon, SendIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { fullName } from "@/lib/format"
import { useStore } from "@/lib/store"
import { ALL_NAV } from "./nav"

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const accounts = useStore((s) => s.accounts)
  const contacts = useStore((s) => s.contacts)
  const deals = useStore((s) => s.deals)
  const sequences = useStore((s) => s.sequences)
  const simulateSignal = useStore((s) => s.simulateSignal)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-8 w-full justify-start gap-2 text-muted-foreground sm:w-64"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline-block">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search records and jump to pages">
        <CommandInput placeholder="Search accounts, contacts, deals, pages…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setOpen(false)
                const run = simulateSignal()
                toast.success("Signal ingested", { description: run ? `Agent: ${run.status.replace("_", " ")}` : "Queued (autopilot off)" })
              }}
            >
              <RadioTowerIcon /> Simulate incoming signal
            </CommandItem>
            <CommandItem onSelect={() => go("/accounts?new=1")}>
              <Building2Icon /> Add account
            </CommandItem>
            <CommandItem onSelect={() => go("/pipeline?new=1")}>
              <KanbanSquareIcon /> Create deal
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Pages">
            {ALL_NAV.map((n) => (
              <CommandItem key={n.href} onSelect={() => go(n.href)}>
                <n.icon /> {n.title}
                <CommandShortcut>{n.service}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Accounts">
            {accounts.slice(0, 80).map((a) => (
              <CommandItem key={a.id} value={`account ${a.name} ${a.domain}`} onSelect={() => go(`/accounts/${a.id}`)}>
                <Building2Icon /> {a.name}
                <CommandShortcut>{a.domain}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Contacts">
            {contacts.slice(0, 150).map((c) => (
              <CommandItem key={c.id} value={`contact ${fullName(c)} ${c.email}`} onSelect={() => go(`/contacts?id=${c.id}`)}>
                <UserIcon /> {fullName(c)}
                <CommandShortcut>{c.title}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Deals">
            {deals.map((d) => (
              <CommandItem key={d.id} value={`deal ${d.name}`} onSelect={() => go(`/pipeline?deal=${d.id}`)}>
                <KanbanSquareIcon /> {d.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Sequences">
            {sequences.map((q) => (
              <CommandItem key={q.id} value={`sequence ${q.name}`} onSelect={() => go(`/outreach/${q.id}`)}>
                <SendIcon /> {q.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
