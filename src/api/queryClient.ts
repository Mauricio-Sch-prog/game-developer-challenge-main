import { QueryClient } from '@tanstack/react-query'
import { isRetryableError } from './client'

/** Retries network errors, timeouts and 5xx up to twice; a 4xx is final. */
export const shouldRetry = (failureCount: number, error: unknown): boolean => failureCount < 2 && isRetryableError(error)
export const retryDelay = (attempt: number): number => Math.min(500 * 2 ** attempt, 3000)

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Always stale: re-showing a tab refetches in the background while the
      // cached page stays on screen.
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      retryDelay,
      refetchOnWindowFocus: true,
    },
  },
})
