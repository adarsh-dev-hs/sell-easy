"use client"

import { useState } from "react"
import { ChevronsUpDownIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CompanyAvatar } from "@/components/shared/avatars"
import { useAccounts } from "@/lib/api"
import { useDebounced } from "./use-debounced"

export interface PickedAccount {
  id: string
  name: string
}

/** Account combobox that searches the server (`/accounts?q=`) as you type. */
export function AccountPicker({
  value,
  onChange,
  id,
}: {
  value: PickedAccount | null
  onChange: (account: PickedAccount) => void
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const debouncedQ = useDebounced(q.trim(), 250)
  const { data, isFetching, isError } = useAccounts({ q: debouncedQ, pageSize: 20, sort: "name:asc" }, open)
  // Duplicates are merged/flagged records — never attach signals to them.
  const options = (data?.data ?? []).filter((a) => !a.duplicateOf)

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {value ? (
            <span className="flex min-w-0 items-center gap-2">
              <CompanyAvatar name={value.name} className="size-5 text-[9px]" />
              <span className="truncate">{value.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select account…</span>
          )}
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search accounts…" value={q} onValueChange={setQ} />
          <CommandList>
            {isFetching && options.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Searching…
              </div>
            ) : (
              <CommandEmpty>{isError ? "Couldn't load accounts." : "No accounts found."}</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((a) => (
                <CommandItem
                  key={a.id}
                  value={a.id}
                  data-checked={value?.id === a.id}
                  onSelect={() => {
                    onChange({ id: a.id, name: a.name })
                    setOpen(false)
                  }}
                >
                  <CompanyAvatar name={a.name} className="size-5 text-[9px]" />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{a.domain}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
