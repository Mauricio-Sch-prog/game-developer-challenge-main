import { isRecord, readJson, writeJson } from '../storage'

/** Who is playing on this device: a stable id plus the name shown in the ranking. */
export interface PlayerProfile {
  id: string
  name: string
}

const STORAGE_KEY = 'pirate-battle:player'
export const PLAYER_NAME_LIMITS = { min: 2, max: 20 } as const

const DEFAULT_NAMES = ['Captain Jack', 'Captain Morgan', 'Captain Kidd', 'Captain Drake', 'Captain Teach']

/** Loads the profile, creating (and saving) one on the first visit. */
export function loadPlayer(): PlayerProfile {
  const stored = readJson(STORAGE_KEY)
  if (isRecord(stored) && typeof stored.id === 'string' && typeof stored.name === 'string' && !validatePlayerName(stored.name)) {
    return { id: stored.id, name: stored.name }
  }
  const profile = {
    id: crypto.randomUUID(),
    name: DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)],
  }
  writeJson(STORAGE_KEY, profile)
  return profile
}

/** Returns an error message, or null when the name is valid. */
export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim()
  const { min, max } = PLAYER_NAME_LIMITS
  return trimmed.length < min || trimmed.length > max ? `Use between ${min} and ${max} characters.` : null
}

/** Keeps the id (history stays attached to this player) and changes the name for new matches. */
export function savePlayerName(name: string): boolean {
  return writeJson(STORAGE_KEY, { ...loadPlayer(), name: name.trim() })
}
