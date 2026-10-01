import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchHistory, fetchRanking } from './client'
import { PAGE_SIZE, type MatchConfig } from './contracts'

/**
 * Query keys. Everything lives under `records`, so one invalidation refreshes
 * both tabs after a match is registered.
 *
 * Each page has its own key: a slow response for page 1 can never overwrite
 * page 2, and invalidation cancels in-flight requests so a late, older answer
 * cannot replace newer data.
 */
export const recordKeys = {
  all: ['records'] as const,
  ranking: (config: MatchConfig, page: number) =>
    ['records', 'ranking', config.sessionSeconds, config.spawnIntervalSeconds, page] as const,
  history: (playerId: string, page: number) => ['records', 'history', playerId, page] as const,
}

export function useRanking(config: MatchConfig, page: number) {
  return useQuery({
    queryKey: recordKeys.ranking(config, page),
    queryFn: ({ signal }) => fetchRanking({ config, page, pageSize: PAGE_SIZE }, signal),
    // While the next page loads, keep showing the current one (no flicker).
    placeholderData: keepPreviousData,
  })
}

export function useHistory(playerId: string, page: number) {
  return useQuery({
    queryKey: recordKeys.history(playerId, page),
    queryFn: ({ signal }) => fetchHistory({ playerId, page, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  })
}
