"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Building2Icon,
  ChevronsUpDownIcon,
  EyeIcon,
  ListPlusIcon,
  Loader2Icon,
  MailCheckIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { BulkBar, nextSort, SortButton, type SortDir, TablePagination } from "@/components/accounts/table-kit"
import { AddContactDialog } from "@/components/contacts/add-contact-dialog"
import { ContactSheet } from "@/components/contacts/contact-sheet"
import { EnrollDialog } from "@/components/contacts/enroll-dialog"
import { CONTACT_STATUSES, EMAIL_STATUSES, SENIORITIES } from "@/components/contacts/options"
import { CompanyAvatar, OwnerLabel, PersonAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { humanize, StatusBadge } from "@/components/shared/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fullName, timeAgo } from "@/lib/format"
import { useLookup, useStore } from "@/lib/store"
import type { Contact } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20
const ALL = "all"

type SortKey = "name" | "account" | "lastContacted" | "created"

export default function ContactsPageWrapper() {
  return (
    <Suspense>
      <ContactsPage />
    </Suspense>
  )
}

function ContactsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lookup = useLookup()
  const contacts = useStore((s) => s.contacts)
  const accounts = useStore((s) => s.accounts)
  const verifyEmails = useStore((s) => s.verifyEmails)
  const deleteContacts = useStore((s) => s.deleteContacts)

  const [search, setSearch] = useState("")
  const [seniority, setSeniority] = useState(ALL)
  const [emailStatus, setEmailStatus] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [accountId, setAccountId] = useState(ALL)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "created", dir: "desc" })
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [verifying, setVerifying] = useState<string[]>([])
  const [enrollIds, setEnrollIds] = useState<string[] | null>(null)
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  // Sheet: explicit selection, or `?id=` from a deep link
  const paramId = searchParams.get("id")
  const [openId, setOpenId] = useState<string | null>(null)
  const [dismissedParam, setDismissedParam] = useState<string | null>(null)
  const activeId = openId ?? (paramId && paramId !== dismissedParam ? paramId : null)
  const closeSheet = () => {
    setOpenId(null)
    if (paramId) {
      setDismissedParam(paramId)
      router.replace("/contacts")
    }
  }

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = contacts.filter((c) => {
      if (q) {
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.title}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (seniority !== ALL && c.seniority !== seniority) return false
      if (emailStatus !== ALL && c.emailStatus !== emailStatus) return false
      if (status !== ALL && c.status !== status) return false
      if (accountId !== ALL && c.accountId !== accountId) return false
      return true
    })
    const cmp: Record<SortKey, (a: Contact, b: Contact) => number> = {
      name: (a, b) => fullName(a).localeCompare(fullName(b)),
      account: (a, b) => (accountName.get(a.accountId) ?? "").localeCompare(accountName.get(b.accountId) ?? ""),
      lastContacted: (a, b) => (a.lastContactedAt ?? "").localeCompare(b.lastContactedAt ?? ""),
      created: (a, b) => a.createdAt.localeCompare(b.createdAt),
    }
    const fn = cmp[sort.key]
    return rows.sort((a, b) => (sort.dir === "asc" ? fn(a, b) : fn(b, a)))
  }, [contacts, search, seniority, emailStatus, status, accountId, sort, accountName])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const selectedIds = useMemo(() => {
    const ids = new Set(contacts.map((c) => c.id))
    return selected.filter((id) => ids.has(id))
  }, [selected, contacts])

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selectedIds.includes(r.id))
  const someOnPage = pageRows.some((r) => selectedIds.includes(r.id))
  const togglePage = (on: boolean) => {
    const ids = pageRows.map((r) => r.id)
    setSelected((prev) => (on ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id))))
  }
  const toggleRow = (id: string, on: boolean) => setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))

  const withReset =
    (setter: (v: string) => void) =>
    (v: string): void => {
      setter(v)
      setPage(0)
    }
  const hasFilters = search || seniority !== ALL || emailStatus !== ALL || status !== ALL || accountId !== ALL
  const clearFilters = () => {
    setSearch("")
    setSeniority(ALL)
    setEmailStatus(ALL)
    setStatus(ALL)
    setAccountId(ALL)
    setPage(0)
  }
  const onSort = (k: SortKey) => setSort((p) => nextSort(p, k, k === "name" || k === "account" ? "asc" : "desc"))

  const runVerify = async (ids: string[]) => {
    if (ids.length === 0) return
    setVerifying((p) => [...p, ...ids])
    const toastId = toast.loading(`Verifying ${ids.length} email${ids.length === 1 ? "" : "s"} (waterfall: FullEnrich → ZeroBounce)…`)
    try {
      const missingBefore = useStore.getState().contacts.filter((c) => ids.includes(c.id) && c.emailStatus === "missing").length
      await verifyEmails(ids)
      const after = useStore.getState().contacts.filter((c) => ids.includes(c.id))
      const ok = after.filter((c) => c.emailStatus === "verified").length
      toast.success(`Checked ${ids.length} contact${ids.length === 1 ? "" : "s"}`, {
        id: toastId,
        description: `${ok} verified · ${after.length - ok} invalid${missingBefore ? ` · ${missingBefore} new emails found` : ""}`,
      })
    } catch {
      toast.error("Verification failed", { id: toastId })
    } finally {
      setVerifying((p) => p.filter((id) => !ids.includes(id)))
    }
  }

  const confirmDelete = () => {
    if (!deleteIds) return
    const label = deleteIds.length === 1 ? fullName(lookup.contact(deleteIds[0]) ?? { firstName: "contact", lastName: "" }) : `${deleteIds.length} contacts`
    deleteContacts(deleteIds)
    setSelected((p) => p.filter((id) => !deleteIds.includes(id)))
    toast.success(`Deleted ${label.trim()}`)
    setDeleteIds(null)
  }

  const bulkVerifying = selectedIds.some((id) => verifying.includes(id))

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${contacts.length.toLocaleString()} people across ${accounts.filter((a) => !a.duplicateOf).length} accounts.`}
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon /> Add contact
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, title…"
              className="pl-8"
              value={search}
              onChange={(e) => withReset(setSearch)(e.target.value)}
            />
          </div>
          <FilterSelect value={seniority} onChange={withReset(setSeniority)} label="Seniority" allLabel="All seniorities" options={SENIORITIES.map((s) => [s, s])} />
          <FilterSelect
            value={emailStatus}
            onChange={withReset(setEmailStatus)}
            label="Email status"
            allLabel="Any email status"
            options={EMAIL_STATUSES.map((s) => [s, humanize(s)])}
          />
          <FilterSelect value={status} onChange={withReset(setStatus)} label="Status" allLabel="All statuses" options={CONTACT_STATUSES.map((s) => [s, humanize(s)])} />
          <AccountFilter value={accountId} onChange={withReset(setAccountId)} />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XIcon /> Reset
            </Button>
          )}
        </div>

        <BulkBar count={selectedIds.length} onClear={() => setSelected([])}>
          <Button variant="outline" size="sm" disabled={bulkVerifying} onClick={() => runVerify(selectedIds)}>
            {bulkVerifying ? <Loader2Icon className="animate-spin" /> : <MailCheckIcon />} Verify / find emails
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEnrollIds(selectedIds)}>
            <ListPlusIcon /> Enroll in sequence
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteIds(selectedIds)}>
            <Trash2Icon /> Delete
          </Button>
        </BulkBar>

        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Select page"
                    checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                    onCheckedChange={(v) => togglePage(v === true)}
                  />
                </TableHead>
                <TableHead className="min-w-[220px]">
                  <SortButton label="Name" column="name" sort={sort} onSort={onSort} />
                </TableHead>
                <TableHead>
                  <SortButton label="Account" column="account" sort={sort} onSort={onSort} />
                </TableHead>
                <TableHead>Seniority</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>
                  <SortButton label="Last contacted" column="lastContacted" sort={sort} onSort={onSort} />
                </TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="p-6">
                    <EmptyState
                      icon={UsersIcon}
                      title="No contacts match"
                      description="Try a different search or clear your filters."
                      action={
                        hasFilters ? (
                          <Button variant="outline" size="sm" onClick={clearFilters}>
                            Clear filters
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => setAddOpen(true)}>
                            <PlusIcon /> Add contact
                          </Button>
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((c) => {
                const isSel = selectedIds.includes(c.id)
                const account = lookup.account(c.accountId)
                const isVerifying = verifying.includes(c.id)
                const name = fullName(c)
                return (
                  <TableRow
                    key={c.id}
                    data-state={isSel ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => setOpenId(c.id)}
                  >
                    <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Select ${name}`} checked={isSel} onCheckedChange={(v) => toggleRow(c.id, v === true)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{name}</div>
                          <div className="max-w-[220px] truncate text-xs text-muted-foreground">{c.title}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {account ? (
                        <Link href={`/accounts/${account.id}`} className="flex items-center gap-2 hover:underline">
                          <CompanyAvatar name={account.name} className="size-6 text-[10px]" />
                          <span className="max-w-[160px] truncate">{account.name}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.seniority}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <span className="max-w-[220px] truncate">{c.email || <span className="text-muted-foreground">No email</span>}</span>
                        {isVerifying ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2Icon className="size-3 animate-spin" /> Verifying…
                          </span>
                        ) : (
                          <StatusBadge status={c.emailStatus} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <OwnerLabel user={lookup.user(c.ownerId)} />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{timeAgo(c.lastContactedAt)}</TableCell>
                    <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => setOpenId(c.id)}>
                            <EyeIcon /> Open
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={isVerifying} onSelect={() => runVerify([c.id])}>
                            <MailCheckIcon /> {c.emailStatus === "missing" ? "Find email" : "Verify email"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setEnrollIds([c.id])}>
                            <ListPlusIcon /> Enroll in sequence
                          </DropdownMenuItem>
                          {account && (
                            <DropdownMenuItem onSelect={() => router.push(`/accounts/${account.id}`)}>
                              <Building2Icon /> Go to account
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteIds([c.id])}>
                            <Trash2Icon /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <TablePagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </Card>
      </div>

      <ContactSheet contactId={activeId} onOpenChange={(o) => !o && closeSheet()} />
      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} onCreated={(id) => setOpenId(id)} />
      <EnrollDialog
        open={!!enrollIds}
        onOpenChange={(o) => !o && setEnrollIds(null)}
        contactIds={enrollIds ?? []}
        onDone={() => setSelected([])}
      />
      <ConfirmDialog
        open={!!deleteIds}
        onOpenChange={(o) => !o && setDeleteIds(null)}
        title={deleteIds?.length === 1 ? "Delete this contact?" : `Delete ${deleteIds?.length ?? 0} contacts?`}
        description="Contacts and their sequence enrollments will be removed. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </>
  )
}

function FilterSelect({
  value,
  onChange,
  label,
  allLabel,
  options,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  allLabel: string
  options: [string, string][]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-[160px]", value !== ALL && "border-primary/40")} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function AccountFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const accounts = useStore((s) => s.accounts)
  const [open, setOpen] = useState(false)
  const sorted = useMemo(() => [...accounts].sort((a, b) => a.name.localeCompare(b.name)), [accounts])
  const selected = value === ALL ? undefined : accounts.find((a) => a.id === value)
  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[190px] justify-between font-normal", selected && "border-primary/40")}
        >
          <span className="truncate">{selected ? selected.name : "All accounts"}</span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search accounts…" />
          <CommandList>
            <CommandEmpty>No accounts found.</CommandEmpty>
            <CommandItem value="__all accounts" data-checked={value === ALL} onSelect={() => pick(ALL)}>
              All accounts
            </CommandItem>
            {sorted.map((a) => (
              <CommandItem key={a.id} value={`${a.name} ${a.domain} ${a.id}`} data-checked={a.id === value} onSelect={() => pick(a.id)}>
                <CompanyAvatar name={a.name} className="size-5 text-[9px]" />
                <span className="truncate">{a.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
