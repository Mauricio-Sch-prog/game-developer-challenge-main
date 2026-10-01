import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { describeApiError, registerMatch } from './client'
import { pendingMatches } from './pendingMatches'
import { recordKeys } from './queries'
import { retryDelay, shouldRetry } from './queryClient'

/**
 * Sends every queued match registration with a TanStack Query mutation.
 * Mounted once at the app root, so it keeps working on every screen,
 * including during a new match: the API never blocks the game.
 */
export function useMatchSync(): void {
  const queryClient = useQueryClient()
  const pending = useSyncExternalStore(pendingMatches.subscribe, pendingMatches.getSnapshot)

  const { mutate } = useMutation({
    mutationKey: ['register-match'],
    mutationFn: registerMatch,
    // Safe to retry: PUT /api/matches/:matchId is idempotent on the server.
    retry: shouldRetry,
    retryDelay,
    onSuccess: ({ record }) => {
      pendingMatches.remove(record.matchId)
      // Ranking and history both show the new match on their next fetch.
      void queryClient.invalidateQueries({ queryKey: recordKeys.all })
    },
    onError: (error, record) => pendingMatches.markFailed(record.matchId, describeApiError(error)),
  })

  useEffect(() => {
    for (const item of pending) {
      // Check the live store, not this render's snapshot: StrictMode runs the
      // effect twice with the same snapshot, and the first run already sent it.
      if (pendingMatches.find(item.record.matchId)?.status !== 'queued') continue
      pendingMatches.markSending(item.record.matchId)
      mutate(item.record)
    }
  }, [pending, mutate])

  // Connection back: try the failed ones again.
  useEffect(() => {
    const retry = () => pendingMatches.retryFailed()
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])
}
