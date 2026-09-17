"use client"

import type { Activity, Contact, Enrollment, Entity, EnrollResult, Sequence, WithAccount } from "@/lib/types"
import { api, type Query } from "../client"
import { useApiMutation, useApiQuery } from "../query"

export type ContactRecord = WithAccount<Entity<Contact>>

export interface ContactFilters extends Query {
  page?: number
  pageSize?: number
  q?: string
  sort?: string
  accountId?: string
  seniority?: Contact["seniority"][]
  emailStatus?: Contact["emailStatus"][]
  status?: Contact["status"][]
  ownerId?: string
}

export type ContactInput = Pick<Contact, "accountId" | "firstName" | "lastName"> &
  Partial<Pick<Contact, "title" | "seniority" | "department" | "email" | "phone" | "linkedinUrl" | "location" | "ownerId" | "status">>

export type EnrollmentWithSequence = Entity<Enrollment> & {
  sequence: { id: string; name: string; status: Sequence["status"]; stepCount: number } | null
}

export const useContacts = (f: ContactFilters, enabled = true) =>
  useApiQuery(["contacts", "list", f], () => api.page<ContactRecord>("/contacts", f), { enabled })

export const useContact = (id: string | undefined | null) =>
  useApiQuery(["contacts", "detail", id], () => api.get<ContactRecord>(`/contacts/${id}`), { enabled: !!id, placeholderData: undefined })

export const useContactEnrollments = (id: string | undefined | null) =>
  useApiQuery(["contacts", "enrollments", id], () => api.get<EnrollmentWithSequence[]>(`/contacts/${id}/enrollments`), {
    enabled: !!id,
  })

export const useContactActivities = (id: string | undefined | null) =>
  useApiQuery(["contacts", "activities", id], () => api.page<Entity<Activity>>(`/contacts/${id}/activities`, { pageSize: 50 }), {
    enabled: !!id,
  })

export function useCreateContact() {
  return useApiMutation((body: ContactInput) => api.post<Entity<Contact>>("/contacts", body), {
    successMessage: (c) => `${c.firstName} ${c.lastName} added`,
  })
}

export function useUpdateContact() {
  return useApiMutation(({ id, ...body }: Partial<ContactInput> & { id: string }) => api.patch<Entity<Contact>>(`/contacts/${id}`, body))
}

export function useDeleteContact() {
  return useApiMutation((id: string) => api.delete(`/contacts/${id}`), { successMessage: "Contact deleted" })
}

export function useBulkDeleteContacts() {
  return useApiMutation((ids: string[]) => api.post<{ deleted: number }>("/contacts/bulk-delete", { ids }), {
    successMessage: (r) => `${r.deleted} contact${r.deleted === 1 ? "" : "s"} deleted`,
  })
}

export function useVerifyEmails() {
  return useApiMutation((ids: string[]) =>
    api.post<{ processed: number; verified: number; invalid: number; found: number }>("/contacts/verify-emails", { ids }),
  )
}

export function useEnrollContacts() {
  return useApiMutation((body: { contactIds: string[]; sequenceId: string }) => api.post<EnrollResult>("/contacts/enroll", body))
}
