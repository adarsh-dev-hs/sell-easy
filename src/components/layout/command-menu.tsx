"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2Icon, KanbanSquareIcon, Loader2Icon, SearchIcon, SendIcon, UserIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useSearch } from "@/lib/api"
import { ALL_NAV } from "./nav"

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const debounced = useDebounced(q.trim(), 200)
  const router = useRouter()
  const search = useSearch(debounced, open)

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
    setQ("")
    router.push(href)
  }

  const needle = q.trim().toLowerCase()
  const pages = ALL_NAV.filter((n) => !needle || n.title.toLowerCase().includes(needle))
  const r = search.data

  return (
    <>
      <Button variant="outline" className="h-8 w-full justify-start gap-2 text-muted-foreground sm:w-64" onClick={() => setOpen(true)}>
        <SearchIcon />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline-block">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search records and jump to pages">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search accounts, contacts, deals, pages…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>{search.isFetching ? "Searching…" : "No results found."}</CommandEmpty>
            {!needle && (
              <CommandGroup heading="Actions">
                <CommandItem onSelect={() => go("/accounts?new=1")}>
                  <Building2Icon /> Add account
                </CommandItem>
                <CommandItem onSelect={() => go("/pipeline?new=1")}>
                  <KanbanSquareIcon /> Create deal
                </CommandItem>
              </CommandGroup>
            )}
            {pages.length > 0 && (
              <CommandGroup heading="Pages">
                {pages.map((n) => (
                  <CommandItem key={n.href} value={`page-${n.href}`} onSelect={() => go(n.href)}>
                    <n.icon /> {n.title}
                    <CommandShortcut>{n.service}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            {search.isFetching && !r && (
              <div className="flex justify-center py-3 text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
              </div>
            )}
            {!!r?.accounts.length && (
              <CommandGroup heading={needle ? "Accounts" : "Recent accounts"}>
                {r.accounts.map((a) => (
                  <CommandItem key={a.id} value={`account-${a.id}`} onSelect={() => go(`/accounts/${a.id}`)}>
                    <Building2Icon /> {a.name}
                    <CommandShortcut>{a.domain}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!!r?.contacts.length && (
              <CommandGroup heading="Contacts">
                {r.contacts.map((c) => (
                  <CommandItem key={c.id} value={`contact-${c.id}`} onSelect={() => go(`/contacts?id=${c.id}`)}>
                    <UserIcon /> {c.name}
                    <CommandShortcut>{c.title}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!!r?.deals.length && (
              <CommandGroup heading="Deals">
                {r.deals.map((d) => (
                  <CommandItem key={d.id} value={`deal-${d.id}`} onSelect={() => go(`/pipeline?deal=${d.id}`)}>
                    <KanbanSquareIcon /> {d.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!!r?.sequences.length && (
              <CommandGroup heading="Sequences">
                {r.sequences.map((s) => (
                  <CommandItem key={s.id} value={`sequence-${s.id}`} onSelect={() => go(`/outreach/${s.id}`)}>
                    <SendIcon /> {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
