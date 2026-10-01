import { isRecord, readJson, writeJson } from '../storage'
import type { MatchRecord } from './contracts'

/**
 * queued  → waiting to be sent (new, retried, or restored after a refresh)
 * sending → request in flight (with automatic retries)
 * failed  → gave up for now; kept until the player retries or the network is back
 */
export type PendingStatus = 'queued' | 'sending' | 'failed'

export interface PendingMatch {
  record: MatchRecord
  status: PendingStatus
  error: string | null
}

const STORAGE_KEY = 'pirate-battle:pending-matches'

function isPendingMatch(value: unknown): value is PendingMatch {
  return isRecord(value) && isRecord(value.record) && typeof value.record.matchId === 'string'
}

function load(): PendingMatch[] {
  const stored = readJson(STORAGE_KEY)
  if (!Array.isArray(stored)) return []
  // A send interrupted by a refresh is queued again: the PUT is idempotent.
  return stored.filter(isPendingMatch).map((item) => (item.status === 'sending' ? { ...item, status: 'queued' } : item))
}

type Listener = () => void

/**
 * Finished matches not yet confirmed by the API, persisted in localStorage.
 * A match only leaves this list when the server confirms it.
 * External store for useSyncExternalStore (same pattern as the GameStore).
 */
class PendingMatches {
  private items: readonly PendingMatch[] = load()
  private readonly listeners = new Set<Listener>()

  readonly getSnapshot = (): readonly PendingMatch[] => this.items

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  find(matchId: string): PendingMatch | undefined {
    return this.items.find((item) => item.record.matchId === matchId)
  }

  add(record: MatchRecord): void {
    if (this.find(record.matchId)) return
    this.set([...this.items, { record, status: 'queued', error: null }])
  }

  markSending(matchId: string): void {
    this.patch(matchId, { status: 'sending', error: null })
  }

  markFailed(matchId: string, error: string): void {
    this.patch(matchId, { status: 'failed', error })
  }

  remove(matchId: string): void {
    this.set(this.items.filter((item) => item.record.matchId !== matchId))
  }

  /** Manual retry: ignored unless it failed, so repeated clicks never send twice. */
  retry(matchId: string): void {
    if (this.find(matchId)?.status === 'failed') this.patch(matchId, { status: 'queued', error: null })
  }

  retryFailed(): void {
    if (!this.items.some((item) => item.status === 'failed')) return
    this.set(this.items.map((item) => (item.status === 'failed' ? { ...item, status: 'queued', error: null } : item)))
  }

  private patch(matchId: string, changes: Partial<PendingMatch>): void {
    this.set(this.items.map((item) => (item.record.matchId === matchId ? { ...item, ...changes } : item)))
  }

  private set(next: readonly PendingMatch[]): void {
    this.items = next
    writeJson(STORAGE_KEY, next)
    this.listeners.forEach((listener) => listener())
  }
}

export const pendingMatches = new PendingMatches()
