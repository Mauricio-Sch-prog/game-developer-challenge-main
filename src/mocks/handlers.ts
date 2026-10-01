import { delay, http, HttpResponse } from 'msw'
import {
  API_ROUTES,
  MAX_PAGE_SIZE,
  type ApiErrorBody,
  type MatchRecord,
  type Page,
  type RankingEntry,
  type RegisterMatchResponse,
} from '../api/contracts'
import { queryHistory, queryRanking, upsertMatch } from './db'
import { getScenario, scenarioLatency, type ScenarioId } from './scenarios'

type Endpoint = 'ranking' | 'history' | 'register'

function errorResponse(status: number, error: string, message: string) {
  return HttpResponse.json<ApiErrorBody>({ error, message }, { status })
}

/**
 * Applies the active scenario before the real handler runs.
 * Returns a response to short-circuit with, or null to continue normally.
 */
async function applyScenario(scenario: ScenarioId, endpoint: Endpoint) {
  switch (scenario) {
    case 'timeout':
      await delay('infinite')
      return null
    case 'offline':
      await delay(scenarioLatency(scenario))
      return HttpResponse.error()
    case 'server-error':
      await delay(scenarioLatency(scenario))
      return errorResponse(500, 'internal_error', 'Simulated server failure.')
    case 'client-error':
      await delay(scenarioLatency(scenario))
      return errorResponse(400, 'bad_request', 'Simulated invalid request.')
    case 'ranking-down':
    case 'history-down':
      if (scenario === `${endpoint}-down`) {
        await delay(scenarioLatency(scenario))
        return errorResponse(503, 'unavailable', `The ${endpoint} service is unavailable.`)
      }
      break
  }
  await delay(scenarioLatency(scenario))
  return null
}

/** Parses `page`/`pageSize`; invalid values are a 400 like a real API would answer. */
function readPaging(url: URL): { page: number; pageSize: number } | null {
  const page = Number(url.searchParams.get('page') ?? '1')
  const pageSize = Number(url.searchParams.get('pageSize') ?? '5')
  const valid = Number.isInteger(page) && page >= 1 && Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= MAX_PAGE_SIZE
  return valid ? { page, pageSize } : null
}

function emptyPage<T>(page: number, pageSize: number): Page<T> {
  return { items: [], page, pageSize, totalItems: 0, totalPages: 1 }
}

function isMatchRecord(value: unknown): value is MatchRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  const config = r.config as Record<string, unknown> | undefined
  return (
    typeof r.matchId === 'string' &&
    typeof r.playerId === 'string' &&
    typeof r.playerName === 'string' &&
    typeof r.finishedAt === 'string' &&
    typeof r.score === 'number' &&
    typeof r.durationSeconds === 'number' &&
    (r.endReason === 'time' || r.endReason === 'death') &&
    typeof config?.sessionSeconds === 'number' &&
    typeof config.spawnIntervalSeconds === 'number'
  )
}

/** Match ids whose first registration response was "lost" (register-timeout scenario). */
const lostResponses = new Set<string>()

export const handlers = [
  http.get(API_ROUTES.ranking, async ({ request }) => {
    const scenario = getScenario()
    const failure = await applyScenario(scenario, 'ranking')
    if (failure) return failure

    const url = new URL(request.url)
    const paging = readPaging(url)
    const sessionSeconds = Number(url.searchParams.get('sessionSeconds'))
    const spawnIntervalSeconds = Number(url.searchParams.get('spawnIntervalSeconds'))
    if (!paging || !sessionSeconds || !spawnIntervalSeconds) {
      return errorResponse(400, 'invalid_query', 'page, pageSize, sessionSeconds and spawnIntervalSeconds are required.')
    }
    const body =
      scenario === 'empty'
        ? emptyPage<RankingEntry>(paging.page, paging.pageSize)
        : queryRanking({ sessionSeconds, spawnIntervalSeconds }, paging.page, paging.pageSize)
    return HttpResponse.json<Page<RankingEntry>>(body)
  }),

  http.get(API_ROUTES.playerMatches, async ({ request, params }) => {
    const scenario = getScenario()
    const failure = await applyScenario(scenario, 'history')
    if (failure) return failure

    const paging = readPaging(new URL(request.url))
    if (!paging) return errorResponse(400, 'invalid_query', 'Invalid page or pageSize.')
    const playerId = String(params.playerId)
    const body =
      scenario === 'empty'
        ? emptyPage<MatchRecord>(paging.page, paging.pageSize)
        : queryHistory(playerId, paging.page, paging.pageSize)
    return HttpResponse.json<Page<MatchRecord>>(body)
  }),

  http.put(API_ROUTES.match, async ({ request, params }) => {
    const scenario = getScenario()
    const failure = await applyScenario(scenario, 'register')
    if (failure) return failure

    const body: unknown = await request.json().catch(() => null)
    if (!isMatchRecord(body) || body.matchId !== params.matchId) {
      return errorResponse(400, 'invalid_match', 'The match record is invalid or does not match the URL.')
    }

    const result = upsertMatch(body)
    // Saved, but the answer never arrives the first time: the client times out
    // and must recover through a retry that gets the existing record back.
    if (scenario === 'register-timeout' && !lostResponses.has(body.matchId)) {
      lostResponses.add(body.matchId)
      await delay('infinite')
    }
    return HttpResponse.json<RegisterMatchResponse>(result, { status: result.created ? 201 : 200 })
  }),
]
