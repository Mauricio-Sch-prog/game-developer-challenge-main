import { DEFAULT_CONFIG, type GameConfig } from '../game/config'
import { isRecord, readJson, writeJson } from '../storage'

/** The two settings the player can change on the Options screen. */
export interface PlayerOptions {
  sessionSeconds: number
  spawnIntervalSeconds: number
}

/**
 * Documented limits. Spawn interval must be positive; below 0.5 s the arena
 * fills up instantly, above 10 s matches become empty.
 */
export const OPTION_LIMITS = {
  sessionSeconds: { min: 60, max: 180, step: 10 },
  spawnIntervalSeconds: { min: 0.5, max: 10, step: 0.5 },
} as const

export const DEFAULT_OPTIONS: PlayerOptions = {
  sessionSeconds: DEFAULT_CONFIG.match.durationSeconds,
  spawnIntervalSeconds: DEFAULT_CONFIG.spawn.intervalSeconds,
}

const STORAGE_KEY = 'pirate-battle:options'

export type OptionErrors = Partial<Record<keyof PlayerOptions, string>>

export function validateOptions(options: PlayerOptions): OptionErrors {
  const errors: OptionErrors = {}
  const session = OPTION_LIMITS.sessionSeconds
  const spawn = OPTION_LIMITS.spawnIntervalSeconds

  if (!Number.isInteger(options.sessionSeconds) || options.sessionSeconds < session.min || options.sessionSeconds > session.max) {
    errors.sessionSeconds = `Enter a whole number of seconds between ${session.min} and ${session.max}.`
  }
  if (
    !Number.isFinite(options.spawnIntervalSeconds) ||
    options.spawnIntervalSeconds < spawn.min ||
    options.spawnIntervalSeconds > spawn.max
  ) {
    errors.spawnIntervalSeconds = `Enter a number of seconds between ${spawn.min} and ${spawn.max}.`
  }
  return errors
}

/** Saved options, or the defaults when nothing valid is stored. */
export function loadOptions(): PlayerOptions {
  const stored = readJson(STORAGE_KEY)
  if (!isRecord(stored)) return DEFAULT_OPTIONS
  const { sessionSeconds, spawnIntervalSeconds } = stored
  if (typeof sessionSeconds !== 'number' || typeof spawnIntervalSeconds !== 'number') return DEFAULT_OPTIONS
  const options: PlayerOptions = { sessionSeconds, spawnIntervalSeconds }
  return Object.keys(validateOptions(options)).length === 0 ? options : DEFAULT_OPTIONS
}

export function saveOptions(options: PlayerOptions): boolean {
  return writeJson(STORAGE_KEY, options)
}

/** Config snapshot for one match: the defaults plus the player's options. */
export function buildMatchConfig(options: PlayerOptions): GameConfig {
  const config = structuredClone(DEFAULT_CONFIG)
  config.match.durationSeconds = options.sessionSeconds
  config.spawn.intervalSeconds = options.spawnIntervalSeconds
  return config
}
