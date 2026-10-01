import axios, { AxiosError } from 'axios'
import {
  apiPaths,
  type ApiErrorBody,
  type HistoryQuery,
  type MatchRecord,
  type Page,
  type RankingEntry,
  type RankingQuery,
  type RegisterMatchResponse,
} from './contracts'

/** A request without an answer after this long fails as a timeout. */
export const API_TIMEOUT_MS = 4000

export const apiClient = axios.create({ timeout: API_TIMEOUT_MS })

export async function fetchRanking({ config, page, pageSize }: RankingQuery, signal?: AbortSignal): Promise<Page<RankingEntry>> {
  const { data } = await apiClient.get<Page<RankingEntry>>(apiPaths.ranking(), {
    params: { page, pageSize, sessionSeconds: config.sessionSeconds, spawnIntervalSeconds: config.spawnIntervalSeconds },
    // Lets TanStack Query abort requests whose result is no longer wanted.
    signal,
  })
  return data
}

export async function fetchHistory({ playerId, page, pageSize }: HistoryQuery, signal?: AbortSignal): Promise<Page<MatchRecord>> {
  const { data } = await apiClient.get<Page<MatchRecord>>(apiPaths.playerMatches(playerId), {
    params: { page, pageSize },
    signal,
  })
  return data
}

/** Idempotent: safe to repeat after a timeout or a double click. */
export async function registerMatch(record: MatchRecord): Promise<RegisterMatchResponse> {
  const { data } = await apiClient.put<RegisterMatchResponse>(apiPaths.match(record.matchId), record)
  return data
}

/** Network errors, timeouts and 5xx are worth retrying; 4xx (a bad request) are not. */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false
  if (error.code === AxiosError.ERR_CANCELED) return false
  const status = error.response?.status
  return status === undefined || status >= 500
}

/** Short, player-friendly description of an API failure. */
export function describeApiError(error: unknown): string {
  if (!(error instanceof AxiosError)) return 'Unexpected error.'
  if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
    return 'The server took too long to answer.'
  }
  const response = error.response
  if (!response) return 'Could not reach the server.'
  const body = response.data as Partial<ApiErrorBody> | undefined
  const detail = typeof body?.message === 'string' ? ` ${body.message}` : ''
  return response.status >= 500 ? `Server error (${response.status}).${detail}` : `Request rejected (${response.status}).${detail}`
}
