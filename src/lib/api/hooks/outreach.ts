"use client"

import type {
  AccountRef,
  Contact,
  Deal,
  Enrollment,
  EnrollResult,
  Entity,
  InboxMessage,
  Mailbox,
  Sequence,
  SequenceSettings,
  SequenceStep,
  StepChannel,
} from "@/lib/types"
import { api, type Query } from "../client"
import { useApiMutation, useApiQuery } from "../query"

export type SequenceRecord = Entity<Sequence> & { activeEnrollments: number; ownerName: string | null }
export type MailboxRecord = Entity<Mailbox> & { usedBy: number }

export type EnrollmentRecord = Entity<Enrollment> & {
  contact: Pick<Contact, "id" | "firstName" | "lastName" | "title" | "email"> | null
  account: { id: string; name: string } | null
}

export type InboxRecord = Entity<InboxMessage> & {
  contact: Pick<Contact, "id" | "firstName" | "lastName" | "title" | "accountId"> | null
  account: Pick<AccountRef, "id" | "name"> | null
  sequenceName: string | null
}

export interface EnrollableContact {
  id: string
  firstName: string
  lastName: string
  title: string
  email: string
  emailStatus: Contact["emailStatus"]
  status: Contact["status"]
  accountId: string
  accountName: string | null
  willSkip: boolean
  skipReason: string | null
}

export interface SequencePerformance {
  sequenceId: string
  stats: Sequence["stats"]
  funnel: { stage: string; label: string; value: number }[]
  rates: { openRate: number; replyRate: number; meetingRate: number; bounceRate: number }
  steps: {
    stepId: string
    index: number
    channel: StepChannel
    dayOffset: number
    subject?: string | null
    reached: number
    /** `null` when the channel has no such metric (e.g. wait steps). */
    primary: number | null
    primaryLabel: string
    secondary: number | null
    secondaryLabel: string
    replied: number | null
  }[]
}

export interface OutreachStats {
  enrolled: number
  sent: number
  opened: number
  replied: number
  meetings: number
  bounced: number
  openRate: number
  replyRate: number
  activeSequences: number
  totalSequences: number
  activeEnrollments: number
}

export type InboxCounts = { unread: number; all: number; positive: number; neutral: number; negative: number; ooo: number }

// ---------- Sequences ----------
export const useSequences = (f: Query & { page?: number; pageSize?: number; q?: string; status?: Sequence["status"][] } = {}) =>
  useApiQuery(["sequences", "list", f], () => api.page<SequenceRecord>("/sequences", { pageSize: 200, ...f }))

export const useSequence = (id: string | undefined) =>
  useApiQuery(["sequences", "detail", id], () => api.get<SequenceRecord>(`/sequences/${id}`), { enabled: !!id, placeholderData: undefined })

export const useOutreachStats = () => useApiQuery(["sequences", "stats"], () => api.get<OutreachStats>("/outreach/stats"))

export const useSequenceEnrollments = (id: string, f: Query & { page?: number; pageSize?: number; status?: Enrollment["status"][]; q?: string }) =>
  useApiQuery(["sequences", "enrollments", id, f], () => api.page<EnrollmentRecord>(`/sequences/${id}/enrollments`, f))

export const useSequencePerformance = (id: string) =>
  useApiQuery(["sequences", "performance", id], () => api.get<SequencePerformance>(`/sequences/${id}/performance`))

export const useEnrollable = (id: string, q: string, enabled: boolean) =>
  useApiQuery(["sequences", "enrollable", id, q], () => api.get<{ items: EnrollableContact[]; total: number }>(`/sequences/${id}/enrollable`, { q }), {
    enabled,
  })

export function useCreateSequence() {
  return useApiMutation(
    (body: { name: string; ownerId?: string; mailboxIds?: string[]; status?: Sequence["status"] }) =>
      api.post<SequenceRecord>("/sequences", body),
    { successMessage: (s) => `Sequence “${s.name}” created` },
  )
}

export function useUpdateSequence() {
  return useApiMutation(
    ({ id, ...body }: { id: string; name?: string; status?: Sequence["status"]; ownerId?: string; mailboxIds?: string[]; settings?: SequenceSettings }) =>
      api.patch<SequenceRecord>(`/sequences/${id}`, body),
  )
}

export function useDeleteSequence() {
  return useApiMutation((id: string) => api.delete(`/sequences/${id}`), { successMessage: "Sequence deleted" })
}

/** Success toast is left to the caller (it offers an "Open" action). */
export function useDuplicateSequence() {
  return useApiMutation((id: string) => api.post<SequenceRecord>(`/sequences/${id}/duplicate`))
}

export function useAddStep() {
  return useApiMutation(({ sequenceId, ...body }: { sequenceId: string } & Partial<Omit<SequenceStep, "id">> & { channel: StepChannel }) =>
    api.post<SequenceStep>(`/sequences/${sequenceId}/steps`, body),
  )
}

export function useUpdateStep() {
  return useApiMutation(({ sequenceId, stepId, ...body }: { sequenceId: string; stepId: string } & Partial<Omit<SequenceStep, "id">>) =>
    api.patch<SequenceStep>(`/sequences/${sequenceId}/steps/${stepId}`, body),
  )
}

export function useRemoveStep() {
  return useApiMutation(({ sequenceId, stepId }: { sequenceId: string; stepId: string }) =>
    api.delete(`/sequences/${sequenceId}/steps/${stepId}`),
  )
}

export function useMoveStep() {
  return useApiMutation(({ sequenceId, stepId, direction }: { sequenceId: string; stepId: string; direction: "up" | "down" }) =>
    api.post<SequenceStep[]>(`/sequences/${sequenceId}/steps/${stepId}/move`, { direction }),
  )
}

export function useEnrollInSequence() {
  return useApiMutation(({ sequenceId, contactIds }: { sequenceId: string; contactIds: string[] }) =>
    api.post<EnrollResult>(`/sequences/${sequenceId}/enroll`, { contactIds }),
  )
}

export function useBulkEnrollmentStatus() {
  return useApiMutation((body: { ids: string[]; status: "active" | "paused" | "completed" }) =>
    api.post<{ updated: number }>("/enrollments/bulk-status", body),
  )
}

export function useRemoveEnrollments() {
  return useApiMutation((ids: string[]) => api.post<{ removed: number }>("/enrollments/bulk-delete", { ids }))
}

// ---------- Mailboxes ----------
export const useMailboxes = () => useApiQuery(["mailboxes"], () => api.get<MailboxRecord[]>("/mailboxes"))

export function useAddMailbox() {
  return useApiMutation((body: Pick<Mailbox, "email" | "provider" | "dailyLimit">) => api.post<MailboxRecord>("/mailboxes", body), {
    successMessage: (m) => `${m.email} connected`,
  })
}

export function useUpdateMailbox() {
  return useApiMutation(({ id, ...body }: { id: string } & Partial<Pick<Mailbox, "dailyLimit" | "warmupEnabled" | "status">>) =>
    api.patch<MailboxRecord>(`/mailboxes/${id}`, body),
  )
}

export function useRemoveMailbox() {
  return useApiMutation((id: string) => api.delete(`/mailboxes/${id}`), { successMessage: "Mailbox removed" })
}

// ---------- Inbox ----------
export const useInbox = (f: Query & { sentiment?: InboxMessage["sentiment"][]; archived?: boolean; unread?: boolean; q?: string; page?: number; pageSize?: number }) =>
  useApiQuery(["inbox", "list", f], () => api.page<InboxRecord>("/inbox", f))

export const useInboxMessage = (id: string | null | undefined, enabled = true) =>
  useApiQuery(["inbox", "detail", id], () => api.get<InboxRecord>(`/inbox/${id}`), { enabled: !!id && enabled, placeholderData: undefined })

export const useInboxCounts = (archived = false) =>
  useApiQuery(["inbox", "counts", archived], () => api.get<InboxCounts>("/inbox/counts", { archived }))

export function useUpdateMessage() {
  return useApiMutation(
    ({ id, ...body }: { id: string; read?: boolean; archived?: boolean; sentiment?: InboxMessage["sentiment"] }) =>
      api.patch<InboxRecord>(`/inbox/${id}`, body),
    { invalidate: [["inbox"]] },
  )
}

export function useReplyToMessage() {
  return useApiMutation(({ id, body }: { id: string; body: string }) => api.post<InboxRecord>(`/inbox/${id}/reply`, { body }), {
    successMessage: "Reply sent",
  })
}

export function useSuggestReply() {
  return useApiMutation((id: string) => api.post<{ body: string }>(`/inbox/${id}/suggest-reply`), { invalidate: "none" })
}

export function useBookMeeting() {
  return useApiMutation((id: string) => api.post<{ deal: Entity<Deal>; created: boolean }>(`/inbox/${id}/book-meeting`))
}
