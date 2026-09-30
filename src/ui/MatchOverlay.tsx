import { useSyncExternalStore } from 'react'
import type { GameStore } from '../game/store/GameStore'
import { formatTime } from './format'

interface MatchOverlayProps {
  store: GameStore
  onResume: () => void
  onRestart: () => void
  onExit: () => void
}

/** Pause and end-of-match dialogs, driven by the store status. */
export function MatchOverlay({ store, onResume, onRestart, onExit }: MatchOverlayProps) {
  const { status, score, timePlayed, endReason } = useSyncExternalStore(store.subscribe, store.getSnapshot)

  if (status === 'paused') {
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div className="panel">
          <h2 id="pause-title">Paused</h2>
          <button type="button" onClick={onResume} autoFocus>
            Resume
          </button>
          <button type="button" className="secondary" onClick={onExit}>
            Main Menu
          </button>
          <p className="hint">Press Esc or P to resume</p>
        </div>
      </div>
    )
  }

  if (status === 'over') {
    // Temporary result dialog; the full Result screen comes on night 2.
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="over-title">
        <div className="panel">
          <h2 id="over-title">{endReason === 'death' ? 'Your ship sank!' : "Time's up!"}</h2>
          <p>
            Score: <strong>{score}</strong> · Time played: {formatTime(timePlayed)}
          </p>
          <button type="button" onClick={onRestart} autoFocus>
            Play Again
          </button>
          <button type="button" className="secondary" onClick={onExit}>
            Main Menu
          </button>
        </div>
      </div>
    )
  }

  return null
}
