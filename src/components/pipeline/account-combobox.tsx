"use client"

import { useMemo, useState } from "react"
import { ChevronsUpDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CompanyAvatar } from "@/components/shared/avatars"
import { useStore } from "@/lib/store"

export function AccountCombobox({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (accountId: string) => void
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const accounts = useStore((s) => s.accounts)
  const options = useMemo(
    () => accounts.filter((a) => !a.duplicateOf).sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  )
  const selected = options.find((a) => a.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <CompanyAvatar name={selected.name} className="size-5 text-[9px]" />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select account…</span>
          )}
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search accounts…" />
          <CommandList>
            <CommandEmpty>No accounts found.</CommandEmpty>
            <CommandGroup>
              {options.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.name} ${a.id}`}
                  keywords={[a.domain, a.industry]}
                  data-checked={value === a.id}
                  onSelect={() => {
                    onChange(a.id)
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
