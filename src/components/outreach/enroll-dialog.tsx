"use client"

import { useState } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { PersonAvatar } from "@/components/shared/avatars"
import { QueryError } from "@/components/shared/query-state"
import { StatusBadge } from "@/components/shared/status"
import { type SequenceRecord, useEnrollable, useEnrollInSequence } from "@/lib/api"
import { fullName } from "@/lib/format"
import { useDebounced } from "./use-debounced"

export function EnrollDialog({ sequence }: { sequence: SequenceRecord }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon /> Enroll contacts
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        {/* DialogContent unmounts on close, so the body's search/selection state resets. */}
        <EnrollBody sequence={sequence} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function EnrollBody({ sequence, onDone }: { sequence: SequenceRecord; onDone: () => void }) {
  const enroll = useEnrollInSequence()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const q = useDebounced(query.trim())

  const enrollable = useEnrollable(sequence.id, q, true)
  const shown = enrollable.data?.items ?? []
  const total = enrollable.data?.total ?? 0
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

  const submit = () => {
    enroll.mutate(
      { sequenceId: sequence.id, contactIds: [...selected] },
      {
        onSuccess: ({ enrolled, skipped }) => {
          if (enrolled === 0) {
            toast.error("No contacts enrolled", { description: `${skipped} skipped (unsubscribed, bounced or invalid email)` })
          } else {
            toast.success(`${enrolled} enrolled, ${skipped} skipped`, { description: sequence.name })
            if (sequence.status !== "active") {
              toast.info("Sequence isn't active", { description: "Activate it to start sending." })
            }
          }
          onDone()
        },
      },
    )
  }

  return (
    <>
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
          placeholder="Search by name, email or title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={allShownSelected} onCheckedChange={(v) => toggleAll(!!v)} disabled={shown.length === 0} />
          Select {shown.length === total ? "all" : `first ${shown.length}`}
        </label>
        <span>
          {total} match{total === 1 ? "" : "es"} · {selected.size} selected
        </span>
      </div>
      <ScrollArea className="h-80 rounded-lg border">
        {enrollable.isError ? (
          <div className="p-3">
            <QueryError error={enrollable.error} onRetry={() => enrollable.refetch()} title="Couldn't load contacts" />
          </div>
        ) : enrollable.isPending ? (
          <ul className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-4" />
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-16" />
              </li>
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No contacts found.</p>
        ) : (
          <ul className="divide-y">
            {shown.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/60">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => toggle(c.id, !!v)} />
                  <PersonAvatar name={fullName(c)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{fullName(c)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.title || "—"} · {c.accountName ?? "—"}
                    </div>
                  </div>
                  {c.willSkip ? (
                    <span title={c.skipReason ?? undefined}>
                      <StatusBadge status={c.emailStatus === "invalid" ? "invalid" : c.status} label="Will skip" />
                    </span>
                  ) : (
                    <StatusBadge status={c.status} />
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={selected.size === 0 || enroll.isPending}>
          {enroll.isPending ? "Enrolling…" : `Enroll ${selected.size || ""} contact${selected.size === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
    </>
  )
}
