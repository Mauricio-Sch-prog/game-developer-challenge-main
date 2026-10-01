import { createRandom, type Random } from '../game/sim/random'
import { readJson, writeJson } from '../storage'

/**
 * Network conditions the mock API can simulate. Selected in Options
 * (or with `?scenario=<id>` in the URL) and persisted across refreshes.
 */
export const SCENARIOS = {
  success: { label: 'Success', description: 'Normal latency (150–400 ms).' },
  empty: { label: 'Empty lists', description: 'Ranking and history answer with no matches.' },
  slow: { label: 'Slow network', description: 'Every response takes about 2.5 seconds.' },
  'variable-latency': {
    label: 'Variable latency',
    description: '100–3000 ms per request, so responses arrive out of order.',
  },
  timeout: { label: 'Timeout', description: 'The server never answers; requests time out.' },
  offline: { label: 'Server unavailable', description: 'Connection failure on every request.' },
  'server-error': { label: 'Server error (500)', description: 'Every request fails with HTTP 500.' },
  'client-error': { label: 'Bad request (400)', description: 'Every request is rejected with HTTP 400.' },
  'ranking-down': { label: 'Ranking down', description: 'Only the ranking fails (HTTP 503).' },
  'history-down': { label: 'History down', description: 'Only the match history fails (HTTP 503).' },
  'register-timeout': {
    label: 'Timeout after registering',
    description: 'The match is saved, but the first response is lost; the retry must not duplicate it.',
  },
} as const

export type ScenarioId = keyof typeof SCENARIOS

const SCENARIO_KEY = 'pirate-battle:mock-scenario'
const DEFAULT_SCENARIO: ScenarioId = 'success'

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && value in SCENARIOS
}

export function getScenario(): ScenarioId {
  const stored = readJson(SCENARIO_KEY)
  return isScenarioId(stored) ? stored : DEFAULT_SCENARIO
}

export function setScenario(id: ScenarioId): void {
  writeJson(SCENARIO_KEY, id)
}

export function resetScenario(): void {
  setScenario(DEFAULT_SCENARIO)
}

/**
 * Test controls from the URL:
 * - `?scenario=<id>` selects (and saves) a scenario,
 * - `?mockSeed=<n>` makes the random latencies reproducible,
 * - `?mockLatency=<ms>` replaces the scenario latency with a fixed value.
 */
const params = new URLSearchParams(window.location.search)
const fromUrl = params.get('scenario')
if (isScenarioId(fromUrl)) setScenario(fromUrl)

const seed = Number(params.get('mockSeed'))
const random: Random = createRandom(Number.isInteger(seed) && seed > 0 ? seed : 1)
const latencyParam = params.get('mockLatency')
const fixedLatency = latencyParam !== null && Number.isFinite(Number(latencyParam)) ? Number(latencyParam) : null

/** Simulated server latency for a normal (non-failing) response, in ms. */
export function scenarioLatency(scenario: ScenarioId): number {
  if (fixedLatency !== null) return fixedLatency
  switch (scenario) {
    case 'slow':
      return 2500
    case 'variable-latency':
      return 100 + Math.round(random() * 2900)
    default:
      return 150 + Math.round(random() * 250)
  }
}
