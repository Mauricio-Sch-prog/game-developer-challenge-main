import { useEffect, useSyncExternalStore } from 'react'
import type { EndReason } from '../game/sim/types'
import type { GameStore } from '../game/store/GameStore'

/** Lets the final explosion play before leaving the arena. */
const RESULT_DELAY_MS = 1500

export interface MatchSummary {
  score: number
  timePlayed: number
  endReason: EndReason
}

interface MatchOverlayProps {
  store: GameStore
  /** Touch device held in portrait: ask to rotate before resuming. */
  rotateHint: boolean
  onResume: () => void
  onExit: () => void
  onFinish: (summary: MatchSummary) => void
}

/** Pause dialog and end-of-match banner, driven by the store status. */
export function MatchOverlay({ store, rotateHint, onResume, onExit, onFinish }: MatchOverlayProps) {
  const { status, score, timePlayed, endReason } = useSyncExternalStore(store.subscribe, store.getSnapshot)

  useEffect(() => {
    if (status !== 'over' || !endReason) return
    const timer = window.setTimeout(() => onFinish({ score, timePlayed, endReason }), RESULT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [status, score, timePlayed, endReason, onFinish])

  if (status === 'paused') {
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div className="panel">
          <h2 id="pause-title">Paused</h2>
          {rotateHint && <p className="rotate-hint">Rotate your device to landscape to play.</p>}
          {/* The game plays its own resume sound. */}
          <button type="button" className="btn btn-primary" onClick={onResume} autoFocus data-sound="none">
            Resume
          </button>
          <button type="button" className="btn btn-secondary" onClick={onExit} data-sound="back">
            Main Menu
          </button>
          <p className="hint">Press Esc or P to resume. Leaving ends this match without saving it.</p>
        </div>
      </div>
    )
  }

  if (status === 'over') {
    return (
      <div className="banner" role="status">
        {endReason === 'death' ? 'Your ship sank!' : "Time's up!"}
      </div>
    )
  }

  return null
}
