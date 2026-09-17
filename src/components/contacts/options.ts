import type { Contact, Seniority } from "@/lib/types"

export const SENIORITIES: Seniority[] = ["C-Level", "VP", "Director", "Manager", "IC"]

export const EMAIL_STATUSES: Contact["emailStatus"][] = ["verified", "unverified", "invalid", "missing"]

export const CONTACT_STATUSES: Contact["status"][] = ["new", "in_sequence", "replied", "meeting", "unsubscribed", "bounced"]

export const DEPARTMENTS = ["Sales", "Marketing", "Revenue Operations", "Engineering", "Product", "Finance", "Operations", "Executive"]
