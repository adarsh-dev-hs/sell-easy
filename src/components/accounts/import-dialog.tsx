"use client"

import { useRef, useState } from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileUpIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadText, errorMessage, fetchImportTemplate, type ImportInput, useImport } from "@/lib/api"
import type { ImportResult } from "@/lib/types"
import { cn } from "@/lib/utils"

export type ImportType = "accounts" | "contacts"

const MAX_BYTES = 5 * 1024 * 1024

const COPY: Record<ImportType, { title: string; description: string; noun: string }> = {
  accounts: {
    title: "Import accounts",
    description: "Upload a CSV or JSON file. Accounts are matched by domain, scored against your ICP and checked for duplicates.",
    noun: "account",
  },
  contacts: {
    title: "Import contacts",
    description:
      "Upload a CSV or JSON file. Contacts are matched by email and linked to an account by accountId, accountDomain or accountName — unknown domains create the account.",
    noun: "contact",
  },
}

interface LoadedFile {
  name: string
  size: number
  format: ImportInput["format"]
  content: string
  rows: number | null
  parseError: string | null
}

/** Counts CSV records (quote-aware, blank lines ignored), excluding the header row. */
function countCsvRows(text: string) {
  let records = 0
  let inQuotes = false
  let hasContent = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') inQuotes = !inQuotes
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (hasContent) records++
      hasContent = false
      if (ch === "\r" && text[i + 1] === "\n") i++
    } else if (!/\s/.test(ch)) hasContent = true
  }
  if (hasContent) records++
  return Math.max(0, records - 1)
}

async function readFile(file: File): Promise<LoadedFile> {
  const content = await file.text()
  const isJson = /\.json$/i.test(file.name) || (!/\.csv$/i.test(file.name) && /^\s*[[{]/.test(content))
  const base = { name: file.name, size: file.size, content, format: (isJson ? "json" : "csv") as ImportInput["format"] }
  if (!isJson) return { ...base, rows: countCsvRows(content), parseError: null }
  try {
    const data: unknown = JSON.parse(content)
    if (!Array.isArray(data)) return { ...base, rows: null, parseError: "JSON must be an array of objects." }
    return { ...base, rows: data.length, parseError: null }
  } catch (e) {
    return { ...base, rows: null, parseError: `Invalid JSON: ${(e as Error).message}` }
  }
}

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

export function ImportDialog({ type, open, onOpenChange }: { type: ImportType; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {open && <ImportForm type={type} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ImportForm({ type, onClose }: { type: ImportType; onClose: () => void }) {
  const copy = COPY[type]
  const inputRef = useRef<HTMLInputElement>(null)
  const importMutation = useImport(type)
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [reading, setReading] = useState(false)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [downloading, setDownloading] = useState(false)

  const pickFile = async (f: File | undefined) => {
    if (!f) return
    setResult(null)
    if (f.size > MAX_BYTES) {
      toast.error(`File is too large (${formatBytes(f.size)}). The limit is ${formatBytes(MAX_BYTES)}.`)
      return
    }
    setReading(true)
    try {
      setFile(await readFile(f))
    } catch (e) {
      toast.error(`Couldn't read file: ${errorMessage(e)}`)
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const csv = await fetchImportTemplate(type)
      downloadText(csv, `${type}-import-template.csv`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setDownloading(false)
    }
  }

  const run = (asDryRun: boolean) => {
    if (!file || file.parseError) return
    importMutation.mutate(
      { format: file.format, content: file.content, dryRun: asDryRun, updateExisting },
      {
        onSuccess: (r) => {
          setResult(r)
          if (r.dryRun) return
          const changed = r.created + r.updated
          if (changed === 0) toast.warning(`No ${copy.noun}s imported`)
          else toast.success(`Imported ${changed} ${copy.noun}${changed === 1 ? "" : "s"}`)
        },
      },
    )
  }

  const canSubmit = !!file && !file.parseError && file.rows !== 0 && !importMutation.isPending

  if (result) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{result.dryRun ? "Validation results" : "Import complete"}</DialogTitle>
          <DialogDescription>
            {file?.name} · {result.total} row{result.total === 1 ? "" : "s"} processed
            {result.dryRun ? " · dry run, nothing was saved" : ""}
          </DialogDescription>
        </DialogHeader>
        <ImportSummary result={result} noun={copy.noun} updateExisting={updateExisting} />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setResult(null)
              setFile(null)
            }}
          >
            Import another file
          </Button>
          {result.dryRun ? (
            <Button disabled={!canSubmit} onClick={() => run(false)}>
              {importMutation.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Run import
            </Button>
          ) : (
            <Button onClick={onClose}>Done</Button>
          )}
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pickFile(e.dataTransfer.files?.[0])
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors hover:bg-muted/50",
            file && !file.parseError && "border-primary/40 bg-primary/5",
          )}
        >
          {reading ? (
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          ) : file ? (
            <FileSpreadsheetIcon className="size-6 text-primary" />
          ) : (
            <FileUpIcon className="size-6 text-muted-foreground" />
          )}
          {file ? (
            <>
              <span className="text-sm font-medium break-all">{file.name}</span>
              <span className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="uppercase">
                  {file.format}
                </Badge>
                {formatBytes(file.size)}
                {file.rows !== null && (
                  <span>
                    · {file.rows.toLocaleString()} row{file.rows === 1 ? "" : "s"} detected
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">Click to choose a different file</span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">Choose a .csv or .json file</span>
              <span className="text-xs text-muted-foreground">or drag and drop it here · up to {formatBytes(MAX_BYTES)}</span>
            </>
          )}
        </button>

        {file?.parseError && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Can’t import this file</AlertTitle>
            <AlertDescription>{file.parseError}</AlertDescription>
          </Alert>
        )}
        {file && !file.parseError && file.rows === 0 && (
          <Alert>
            <AlertTriangleIcon />
            <AlertTitle>No data rows found</AlertTitle>
            <AlertDescription>The file only contains a header (or is empty).</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Not sure about the columns? Start from the template.</span>
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} disabled={downloading}>
            {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />} Download template
          </Button>
        </div>

        <Field orientation="horizontal">
          <Checkbox id={`imp-update-${type}`} checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(v === true)} />
          <FieldContent>
            <FieldLabel htmlFor={`imp-update-${type}`}>Update existing records</FieldLabel>
            <FieldDescription>
              {type === "accounts"
                ? "Rows matching an existing domain overwrite that account’s fields. Otherwise they are skipped."
                : "Rows matching an existing email overwrite that contact’s fields. Otherwise they are skipped."}
            </FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id={`imp-dry-${type}`} checked={dryRun} onCheckedChange={(v) => setDryRun(v === true)} />
          <FieldContent>
            <FieldLabel htmlFor={`imp-dry-${type}`}>Validate only (dry run)</FieldLabel>
            <FieldDescription>Check every row and report what would happen without saving anything.</FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!canSubmit} onClick={() => run(dryRun)}>
          {importMutation.isPending ? <Loader2Icon className="animate-spin" /> : dryRun ? <CheckCircle2Icon /> : <UploadIcon />}
          {dryRun ? "Validate" : `Import${file?.rows ? ` ${file.rows.toLocaleString()} rows` : ""}`}
        </Button>
      </DialogFooter>
    </>
  )
}

function ImportSummary({ result, noun, updateExisting }: { result: ImportResult; noun: string; updateExisting: boolean }) {
  const verb = result.dryRun ? "Would be " : ""
  const stats: { label: string; value: number; tone?: string }[] = [
    { label: `${verb}created`, value: result.created, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: `${verb}updated`, value: result.updated, tone: "text-sky-600 dark:text-sky-400" },
    { label: "Skipped", value: result.skipped },
    { label: "Errors", value: result.errors.length, tone: result.errors.length ? "text-destructive" : undefined },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border p-3">
            <div className={cn("text-2xl font-semibold tabular-nums", s.value > 0 && s.tone)}>{s.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground first-letter:uppercase">{s.label}</div>
          </div>
        ))}
      </div>
      {result.accountsCreated ? (
        <p className="text-sm text-muted-foreground">
          {result.dryRun ? "Would also create" : "Also created"} {result.accountsCreated} new account
          {result.accountsCreated === 1 ? "" : "s"} for unknown domains.
        </p>
      ) : null}
      {result.skipped > 0 && (
        <p className="text-sm text-muted-foreground">
          Skipped rows repeat an earlier row in the file or match an existing {noun}
          {updateExisting ? "." : " — enable “Update existing records” to overwrite existing ones."}
        </p>
      )}
      {result.errors.length > 0 ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-20 pl-3">Row</TableHead>
                <TableHead className="pr-3">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.errors.map((e, i) => (
                <TableRow key={`${e.row}-${i}`}>
                  <TableCell className="pl-3 font-mono text-xs tabular-nums">{e.row}</TableCell>
                  <TableCell className="pr-3 text-sm whitespace-normal">{e.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2Icon className="size-4" /> No row errors.
        </p>
      )}
    </div>
  )
}
