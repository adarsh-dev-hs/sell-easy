"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status"
import { useStore } from "@/lib/store"

export function NewSequenceDialog() {
  const router = useRouter()
  const users = useStore((s) => s.users)
  const mailboxes = useStore((s) => s.mailboxes)
  const currentUserId = useStore((s) => s.currentUserId)
  const addSequence = useStore((s) => s.addSequence)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [mailboxIds, setMailboxIds] = useState<string[]>([])

  const reset = () => {
    setName("")
    setOwnerId("")
    setMailboxIds([])
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const id = addSequence({ name: name.trim(), ownerId: ownerId || currentUserId, mailboxIds })
    toast.success("Sequence created", { description: name.trim() })
    setOpen(false)
    reset()
    router.push(`/outreach/${id}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> New sequence
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>New sequence</DialogTitle>
            <DialogDescription>Create a multi-channel cadence. You can add steps after creating it.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="seq-name">Name</FieldLabel>
              <Input
                id="seq-name"
                autoFocus
                placeholder="e.g. Series B follow-up"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="seq-owner">Owner</FieldLabel>
              <Select value={ownerId || currentUserId} onValueChange={setOwnerId}>
                <SelectTrigger id="seq-owner" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.status === "active")
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Sending mailboxes</FieldLabel>
              <FieldDescription>Emails rotate across the selected mailboxes.</FieldDescription>
              <div className="space-y-1 rounded-lg border p-2">
                {mailboxes.length === 0 && <p className="p-2 text-sm text-muted-foreground">No mailboxes connected yet.</p>}
                {mailboxes.map((m) => {
                  const checked = mailboxIds.includes(m.id)
                  return (
                    <Label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md p-2 font-normal hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setMailboxIds((prev) => (v ? [...prev, m.id] : prev.filter((x) => x !== m.id)))
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{m.email}</span>
                      <StatusBadge status={m.status} />
                    </Label>
                  )
                })}
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create sequence
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
