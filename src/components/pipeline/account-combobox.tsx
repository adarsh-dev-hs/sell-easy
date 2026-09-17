"use client"

import { useState } from "react"
import { ChevronsUpDownIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CompanyAvatar } from "@/components/shared/avatars"
import { type AccountRecord, useAccount, useAccounts } from "@/lib/api"
import { useDebounced } from "./hooks"

export function AccountCombobox({
  value,
  onChange,
  id,
}: {
  value: string
  /** `account` is the selected record (useful for defaults such as owner or deal name). */
  onChange: (accountId: string, account?: AccountRecord) => void
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const q = useDebounced(search.trim(), 250)

  const { data, isFetching } = useAccounts({ q, pageSize: 20, sort: "name:asc", excludeDuplicates: true }, open)
  // Duplicates are merged/flagged records — never offer them as a deal account.
  const options = data?.data ?? []

  const listed = options.find((a) => a.id === value)
  const { data: fetched } = useAccount(value && !listed ? value : undefined)
  const selected = listed ?? (fetched?.id === value ? fetched : undefined)

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSearch("")
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <CompanyAvatar name={selected.name} className="size-5 text-[9px]" />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{value ? "Loading…" : "Select account…"}</span>
          )}
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search accounts…" value={search} onValueChange={setSearch} />
          <CommandList>
            {!data && isFetching ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Searching…
              </div>
            ) : (
              <CommandEmpty>No accounts found.</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((a) => (
                <CommandItem
                  key={a.id}
                  value={a.id}
                  data-checked={value === a.id}
                  onSelect={() => {
                    onChange(a.id, a)
                    setOpen(false)
                    setSearch("")
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
