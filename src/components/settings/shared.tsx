"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function copyText(text: string, label = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(label)
    return true
  } catch {
    toast.error("Couldn't access the clipboard — copy it manually")
    return false
  }
}

export function CopyButton({
  value,
  label = "Copy",
  toastLabel,
  size = "sm",
  variant = "outline",
}: {
  value: string
  label?: string
  toastLabel?: string
  size?: "sm" | "default" | "icon-sm"
  variant?: "outline" | "ghost" | "default" | "secondary"
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      aria-label={label}
      onClick={async () => {
        if (await copyText(value, toastLabel)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {size !== "icon-sm" && (copied ? "Copied" : label)}
    </Button>
  )
}
