"use client"

import {
  keepPreviousData,
  QueryClient,
  useMutation,
  type UseMutationOptions,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, errorMessage } from "./client"

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  })
}

/** Query wrapper that keeps the previous page's data while filters change. */
export function useApiQuery<T>(key: readonly unknown[], fn: () => Promise<T>, opts: Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, "queryKey" | "queryFn"> = {}) {
  return useQuery({ queryKey: key, queryFn: fn, placeholderData: keepPreviousData, ...opts })
}

export interface ApiMutationOptions<TData, TVars> extends Omit<UseMutationOptions<TData, Error, TVars>, "mutationFn"> {
  /** Toast shown on success (string or builder). Omit for silent success. */
  successMessage?: string | ((data: TData, vars: TVars) => string | undefined)
  /** Show an error toast automatically (default true). */
  toastError?: boolean
  /**
   * Query key prefixes to invalidate on success. Defaults to *all* queries: server-side
   * business rules (agent runs, re-scoring, enrollments…) touch many resources at once.
   */
  invalidate?: readonly (readonly unknown[])[] | "all" | "none"
}

export function useApiMutation<TData = unknown, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  { successMessage, toastError = true, invalidate = "all", onSuccess, onError, ...rest }: ApiMutationOptions<TData, TVars> = {},
) {
  const qc = useQueryClient()
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    ...rest,
    onSuccess: async (data, vars, ...more) => {
      if (invalidate === "all") await qc.invalidateQueries()
      else if (invalidate !== "none") await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })))
      const msg = typeof successMessage === "function" ? successMessage(data, vars) : successMessage
      if (msg) toast.success(msg)
      await onSuccess?.(data, vars, ...more)
    },
    onError: (err, vars, ...more) => {
      if (toastError) toast.error(errorMessage(err))
      onError?.(err, vars, ...more)
    },
  })
}
