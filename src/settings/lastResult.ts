import type { EndReason } from '../game/sim/types'
import { isRecord, readJson, writeJson } from '../storage'
import type { PlayerOptions } from './options'

export interface MatchResult {
  score: number
  /** Seconds of active play (pauses excluded). */
  timePlayed: number
  endReason: EndReason
  /** ISO date of when the match ended. */
  finishedAt: string
  /** Options the match was played with. */
  options: PlayerOptions
}

const STORAGE_KEY = 'pirate-battle:last-result'

function isMatchResult(value: unknown): value is MatchResult {
  return (
    isRecord(value) &&
    typeof value.score === 'number' &&
    typeof value.timePlayed === 'number' &&
    (value.endReason === 'time' || value.endReason === 'death') &&
    typeof value.finishedAt === 'string' &&
    isRecord(value.options)
  )
}

export function loadLastResult(): MatchResult | null {
  const stored = readJson(STORAGE_KEY)
  return isMatchResult(stored) ? stored : null
}

export function saveLastResult(result: MatchResult): boolean {
  return writeJson(STORAGE_KEY, result)
}
