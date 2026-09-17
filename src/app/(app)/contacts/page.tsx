"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Building2Icon,
  EyeIcon,
  ListPlusIcon,
  Loader2Icon,
  MailCheckIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { ImportDialog } from "@/components/accounts/import-dialog"
import { BulkBar, nextSort, SortButton, type SortDir, TablePagination } from "@/components/accounts/table-kit"
import { useDebounced } from "@/components/accounts/use-debounced"
import { type AccountOption, AccountPicker, AddContactDialog } from "@/components/contacts/add-contact-dialog"
import { ContactSheet } from "@/components/contacts/contact-sheet"
import { EnrollDialog } from "@/components/contacts/enroll-dialog"
import { CONTACT_STATUSES, EMAIL_STATUSES, SENIORITIES } from "@/components/contacts/options"
import { CompanyAvatar, OwnerLabel, PersonAvatar } from "@/components/shared/avatars"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { QueryError, TableSkeleton } from "@/components/shared/query-state"
import { humanize, StatusBadge } from "@/components/shared/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  canWrite,
  type ContactFilters,
  useAccountCounts,
  useBulkDeleteContacts,
  useContacts,
  useCurrentUser,
  useUsers,
  useVerifyEmails,
} from "@/lib/api"
import { fullName, timeAgo } from "@/lib/format"
import type { Contact } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20
const ALL = "all"

type SortKey = "name" | "lastContacted" | "created"

/** UI sort column → API sort field. */
const SORT_FIELDS: Record<SortKey, string> = {
  name: "firstName",
  lastContacted: "lastContactedAt",
  created: "createdAt",
}

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
  const me = useCurrentUser()
  const writable = canWrite(me.role)
  const { data: users } = useUsers()
  const { data: counts } = useAccountCounts()
  const { data: allContacts } = useContacts({ pageSize: 1 })
  const verifyEmails = useVerifyEmails()
  const bulkDelete = useBulkDeleteContacts()

  const [search, setSearch] = useState("")
  const [seniority, setSeniority] = useState(ALL)
  const [emailStatus, setEmailStatus] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [account, setAccount] = useState<AccountOption | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "created", dir: "desc" })
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [verifying, setVerifying] = useState<string[]>([])
  const [enrollIds, setEnrollIds] = useState<string[] | null>(null)
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

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

  const q = useDebounced(search.trim())
  const filters: ContactFilters = {
    q: q || undefined,
    seniority: seniority !== ALL ? [seniority as Contact["seniority"]] : undefined,
    emailStatus: emailStatus !== ALL ? [emailStatus as Contact["emailStatus"]] : undefined,
    status: status !== ALL ? [status as Contact["status"]] : undefined,
    accountId: account?.id,
    sort: `${SORT_FIELDS[sort.key]}:${sort.dir}`,
    page: page + 1,
    pageSize: PAGE_SIZE,
  }
  const listQuery = useContacts(filters)
  const pageRows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id))
  const someOnPage = pageRows.some((r) => selected.includes(r.id))
  const togglePage = (on: boolean) => {
    const ids = pageRows.map((r) => r.id)
    setSelected((prev) => (on ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id))))
  }
  const toggleRow = (id: string, on: boolean) => setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))

  const withReset =
    <T,>(setter: (v: T) => void) =>
    (v: T): void => {
      setter(v)
      setPage(0)
    }
  const hasFilters = search || seniority !== ALL || emailStatus !== ALL || status !== ALL || account
  const clearFilters = () => {
    setSearch("")
    setSeniority(ALL)
    setEmailStatus(ALL)
    setStatus(ALL)
    setAccount(null)
    setPage(0)
  }
  const onSort = (k: SortKey) => withReset(setSort)(nextSort(sort, k, k === "name" ? "asc" : "desc"))

  const runVerify = async (ids: string[]) => {
    if (ids.length === 0) return
    setVerifying((p) => [...p, ...ids])
    const toastId = toast.loading(`Verifying ${ids.length} email${ids.length === 1 ? "" : "s"}…`)
    try {
      const r = await verifyEmails.mutateAsync(ids)
      toast.success(`Checked ${r.processed} contact${r.processed === 1 ? "" : "s"}`, {
        id: toastId,
        description: `${r.verified} verified · ${r.invalid} invalid${r.found ? ` · ${r.found} new email${r.found === 1 ? "" : "s"} found` : ""}`,
      })
    } catch {
      toast.dismiss(toastId) // error toast is shown by the mutation
    } finally {
      setVerifying((p) => p.filter((id) => !ids.includes(id)))
    }
  }

  const confirmDelete = () => {
    if (!deleteIds) return
    const ids = deleteIds
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        setSelected((p) => p.filter((id) => !ids.includes(id)))
        if (ids.length >= pageRows.length && page > 0) setPage((p) => p - 1)
      },
    })
    setDeleteIds(null)
  }

  const bulkVerifying = selected.some((id) => verifying.includes(id))
  const deleteLabel = (() => {
    if (!deleteIds || deleteIds.length !== 1) return `${deleteIds?.length ?? 0} contacts`
    const c = pageRows.find((r) => r.id === deleteIds[0])
    return c ? fullName(c) : "this contact"
  })()

  return (
    <>
      <PageHeader
        title="Contacts"
        description={
          allContacts && counts
            ? `${allContacts.meta.total.toLocaleString()} people across ${counts.all.toLocaleString()} accounts.`
            : "People at the accounts you sell to."
        }
        actions={
          writable && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <UploadIcon /> Import
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon /> Add contact
              </Button>
            </>
          )
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
          <AccountPicker value={account} onChange={withReset(setAccount)} allLabel="All accounts" className="w-[190px]" />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XIcon /> Reset
            </Button>
          )}
          {listQuery.isFetching && !listQuery.isLoading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {writable && (
          <BulkBar count={selected.length} onClear={() => setSelected([])}>
            <Button variant="outline" size="sm" disabled={bulkVerifying} onClick={() => runVerify(selected)}>
              {bulkVerifying ? <Loader2Icon className="animate-spin" /> : <MailCheckIcon />} Verify / find emails
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEnrollIds(selected)}>
              <ListPlusIcon /> Enroll in sequence
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteIds(selected)}>
              <Trash2Icon /> Delete
            </Button>
          </BulkBar>
        )}

        {listQuery.error && !listQuery.data ? (
          <QueryError error={listQuery.error} onRetry={() => listQuery.refetch()} title="Couldn't load contacts" />
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            {listQuery.isLoading ? (
              <TableSkeleton rows={10} />
            ) : (
              <Table className={cn(listQuery.isPlaceholderData && "opacity-60 transition-opacity")}>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {writable && (
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          aria-label="Select page"
                          checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                          onCheckedChange={(v) => togglePage(v === true)}
                        />
                      </TableHead>
                    )}
                    <TableHead className={cn("min-w-[220px]", !writable && "pl-4")}>
                      <SortButton label="Name" column="name" sort={sort} onSort={onSort} />
                    </TableHead>
                    <TableHead>Account</TableHead>
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
                          title={hasFilters ? "No contacts match" : "No contacts yet"}
                          description={hasFilters ? "Try a different search or clear your filters." : "Add people manually or import them from a file."}
                          action={
                            hasFilters ? (
                              <Button variant="outline" size="sm" onClick={clearFilters}>
                                Clear filters
                              </Button>
                            ) : writable ? (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                                  <UploadIcon /> Import
                                </Button>
                                <Button size="sm" onClick={() => setAddOpen(true)}>
                                  <PlusIcon /> Add contact
                                </Button>
                              </div>
                            ) : undefined
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {pageRows.map((c) => {
                    const isSel = selected.includes(c.id)
                    const acc = c.account
                    const isVerifying = verifying.includes(c.id)
                    const name = fullName(c)
                    return (
                      <TableRow
                        key={c.id}
                        data-state={isSel ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => setOpenId(c.id)}
                      >
                        {writable && (
                          <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox aria-label={`Select ${name}`} checked={isSel} onCheckedChange={(v) => toggleRow(c.id, v === true)} />
                          </TableCell>
                        )}
                        <TableCell className={cn(!writable && "pl-4")}>
                          <div className="flex items-center gap-3">
                            <PersonAvatar name={name} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{name}</div>
                              <div className="max-w-[220px] truncate text-xs text-muted-foreground">{c.title}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {acc ? (
                            <Link href={`/accounts/${acc.id}`} className="flex items-center gap-2 hover:underline">
                              <CompanyAvatar name={acc.name} className="size-6 text-[10px]" />
                              <span className="max-w-[160px] truncate">{acc.name}</span>
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
                          <OwnerLabel user={c.ownerId ? users?.find((u) => u.id === c.ownerId) : undefined} />
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
                              {writable && (
                                <>
                                  <DropdownMenuItem disabled={isVerifying} onSelect={() => runVerify([c.id])}>
                                    <MailCheckIcon /> {c.emailStatus === "missing" ? "Find email" : "Verify email"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setEnrollIds([c.id])}>
                                    <ListPlusIcon /> Enroll in sequence
                                  </DropdownMenuItem>
                                </>
                              )}
                              {acc && (
                                <DropdownMenuItem onSelect={() => router.push(`/accounts/${acc.id}`)}>
                                  <Building2Icon /> Go to account
                                </DropdownMenuItem>
                              )}
                              {writable && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteIds([c.id])}>
                                    <Trash2Icon /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
            <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </Card>
        )}
      </div>

      <ContactSheet contactId={activeId} onOpenChange={(o) => !o && closeSheet()} />
      {writable && (
        <>
          <AddContactDialog open={addOpen} onOpenChange={setAddOpen} onCreated={(id) => setOpenId(id)} />
          <ImportDialog type="contacts" open={importOpen} onOpenChange={setImportOpen} />
          <EnrollDialog
            open={!!enrollIds}
            onOpenChange={(o) => !o && setEnrollIds(null)}
            target={{ kind: "contacts", contactIds: enrollIds ?? [] }}
            onDone={() => setSelected([])}
          />
          <ConfirmDialog
            open={!!deleteIds}
            onOpenChange={(o) => !o && setDeleteIds(null)}
            title={`Delete ${deleteLabel}?`}
            description="Contacts and their sequence enrollments will be removed. This cannot be undone."
            confirmLabel="Delete"
            onConfirm={confirmDelete}
          />
        </>
      )}
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
