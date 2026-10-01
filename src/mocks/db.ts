import {
  compareForRanking,
  sameConfig,
  type MatchConfig,
  type MatchRecord,
  type Page,
  type RankingEntry,
} from '../api/contracts'
import { readJson, writeJson } from '../storage'
import { createFixtureMatches } from './fixtures'

/**
 * The mock server's "database": confirmed matches, persisted in localStorage
 * so they survive a refresh. Starts from the fixtures; `resetDb` restores them.
 */
const DB_KEY = 'pirate-battle:mock-db'

function load(): MatchRecord[] {
  const stored = readJson(DB_KEY)
  return Array.isArray(stored) ? (stored as MatchRecord[]) : createFixtureMatches()
}

function save(records: MatchRecord[]): void {
  writeJson(DB_KEY, records)
}

function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page, pageSize, totalItems: items.length, totalPages }
}

export function resetDb(): void {
  save(createFixtureMatches())
}

/** Matches with the same config, best first; `rank` comes from the full sorted list. */
export function queryRanking(config: MatchConfig, page: number, pageSize: number): Page<RankingEntry> {
  const ranked = load()
    .filter((record) => sameConfig(record.config, config))
    .sort(compareForRanking)
    .map((record, index) => ({ ...record, rank: index + 1 }))
  return paginate(ranked, page, pageSize)
}

/** One player's matches, newest first. */
export function queryHistory(playerId: string, page: number, pageSize: number): Page<MatchRecord> {
  const history = load()
    .filter((record) => record.playerId === playerId)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt) || a.matchId.localeCompare(b.matchId))
  return paginate(history, page, pageSize)
}

/** Idempotent insert keyed by matchId: a second call returns the stored record. */
export function upsertMatch(record: MatchRecord): { record: MatchRecord; created: boolean } {
  const records = load()
  const existing = records.find((stored) => stored.matchId === record.matchId)
  if (existing) return { record: existing, created: false }
  records.push(record)
  save(records)
  return { record, created: true }
}
