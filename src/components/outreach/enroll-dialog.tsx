"use client"

import { useMemo, useState } from "react"
import { SearchIcon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PersonAvatar } from "@/components/shared/avatars"
import { StatusBadge } from "@/components/shared/status"
import { fullName } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Sequence } from "@/lib/types"

const MAX_RESULTS = 100

export function EnrollDialog({ sequence }: { sequence: Sequence }) {
  const contacts = useStore((s) => s.contacts)
  const enrollments = useStore((s) => s.enrollments)
  const enrollContacts = useStore((s) => s.enrollContacts)
  const lookup = useLookup()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const available = useMemo(() => {
    const active = new Set(
      enrollments.filter((e) => e.sequenceId === sequence.id && e.status === "active").map((e) => e.contactId),
    )
    return contacts.filter((c) => !active.has(c.id))
  }, [contacts, enrollments, sequence.id])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return available
    return available.filter((c) =>
      [fullName(c), c.title, c.email, lookup.account(c.accountId)?.name ?? ""].some((v) => v.toLowerCase().includes(q)),
    )
  }, [available, query, lookup])

  const shown = matches.slice(0, MAX_RESULTS)
  const allShownSelected = shown.length > 0 && shown.every((c) => selected.has(c.id))

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const toggleAll = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const c of shown) {
        if (on) next.add(c.id)
        else next.delete(c.id)
      }
      return next
    })

  const close = (o: boolean) => {
    setOpen(o)
    if (!o) {
      setQuery("")
      setSelected(new Set())
    }
  }

  const submit = () => {
    const ids = [...selected]
    const n = enrollContacts(ids, sequence.id)
    const skipped = ids.length - n
    if (n === 0) {
      toast.error("No contacts enrolled", { description: `${skipped} skipped (unsubscribed, bounced or invalid email)` })
    } else {
      toast.success(`${n} enrolled, ${skipped} skipped`, { description: sequence.name })
    }
    if (sequence.status !== "active" && n > 0) {
      toast.info("Sequence isn't active", { description: "Activate it to start sending." })
    }
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon /> Enroll contacts
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enroll contacts</DialogTitle>
          <DialogDescription>
            Add contacts to “{sequence.name}”. Contacts already active in this sequence are hidden; unsubscribed, bounced or invalid
            emails are skipped.
          </DialogDescription>
        </DialogHeader>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            placeholder="Search by name, company or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={allShownSelected} onCheckedChange={(v) => toggleAll(!!v)} disabled={shown.length === 0} />
            Select {shown.length === matches.length ? "all" : `first ${shown.length}`}
          </label>
          <span>
            {matches.length} match{matches.length === 1 ? "" : "es"} · {selected.size} selected
          </span>
        </div>
        <ScrollArea className="h-80 rounded-lg border">
          {shown.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No contacts found.</p>
          ) : (
            <ul className="divide-y">
              {shown.map((c) => {
                const blocked = ["unsubscribed", "bounced"].includes(c.status) || c.emailStatus === "invalid"
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/60">
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => toggle(c.id, !!v)} />
                      <PersonAvatar name={fullName(c)} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{fullName(c)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {c.title} · {lookup.account(c.accountId)?.name ?? "—"}
                        </div>
                      </div>
                      {blocked ? (
                        <StatusBadge status={c.emailStatus === "invalid" ? "invalid" : c.status} label="Will skip" />
                      ) : (
                        <StatusBadge status={c.status} />
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.size === 0}>
            Enroll {selected.size || ""} contact{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
