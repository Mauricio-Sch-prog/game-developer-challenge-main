import { useSyncExternalStore } from 'react'
import { pendingMatches } from '../api/pendingMatches'
import type { MatchResult } from '../settings/lastResult'
import { formatTime } from './format'

/** Where this match's registration stands: saving, saved, or waiting for a retry. */
function RegistrationStatus({ matchId }: { matchId: string }) {
  const pending = useSyncExternalStore(pendingMatches.subscribe, pendingMatches.getSnapshot)
  const item = pending.find((entry) => entry.record.matchId === matchId)

  if (!item) {
    return (
      <p className="registration is-saved" role="status">
        Saved to the ranking and your match history.
      </p>
    )
  }
  if (item.status === 'failed') {
    return (
      <div className="registration is-failed" role="alert">
        <p>Not saved yet: {item.error} It stays on this device until it is sent.</p>
        <button type="button" className="link-button" onClick={() => pendingMatches.retry(matchId)}>
          Retry
        </button>
      </div>
    )
  }
  return (
    <p className="registration" role="status">
      Saving to the ranking…
    </p>
  )
}

interface ResultScreenProps {
  result: MatchResult
  onPlayAgain: () => void
  onMainMenu: () => void
}

export function ResultScreen({ result, onPlayAgain, onMainMenu }: ResultScreenProps) {
  const sunk = result.endReason === 'death'

  return (
    <main className="screen">
      <div className="panel">
        <h1>{sunk ? 'Ship Sunk' : 'Battle Complete'}</h1>
        <p className="result-score">
          <strong>{result.score}</strong>
          <span>{result.score === 1 ? 'point' : 'points'}</span>
        </p>
        <p className="result-meta">
          {formatTime(result.timePlayed)} played · {sunk ? 'Ship destroyed' : 'Time up'}
        </p>
        <RegistrationStatus matchId={result.matchId} />

        <button type="button" className="btn btn-primary" onClick={onPlayAgain} autoFocus>
          Play Again
        </button>
        <button type="button" className="btn btn-secondary" onClick={onMainMenu} data-sound="back">
          Main Menu
        </button>
      </div>
    </main>
  )
}
