import type { EndReason } from '../sim/types'

export type HudStatus = 'running' | 'paused' | 'over'

/** Small, UI-friendly summary of the match. Values are already rounded for display. */
export interface HudState {
  hp: number
  maxHp: number
  score: number
  /** Whole seconds, so it changes once per second, not every frame. */
  timeLeft: number
  /** Seconds of active play (pause excluded). */
  timePlayed: number
  status: HudStatus
  endReason: EndReason | null
}

type Listener = () => void

/**
 * Bridge from the simulation to React (used with `useSyncExternalStore`).
 * The engine may call `update` every frame, but listeners are only notified
 * when a value actually changes, so React renders ~1x per second.
 */
export class GameStore {
  private state: HudState
  private readonly listeners = new Set<Listener>()

  constructor(initial: HudState) {
    this.state = initial
  }

  readonly getSnapshot = (): HudState => this.state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  update(patch: Partial<HudState>): void {
    let changed = false
    for (const key of Object.keys(patch) as (keyof HudState)[]) {
      if (patch[key] !== this.state[key]) {
        changed = true
        break
      }
    }
    if (!changed) return
    // New object on change: that is how useSyncExternalStore detects updates.
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
}
