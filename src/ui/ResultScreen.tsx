import type { MatchResult } from '../settings/lastResult'
import { formatTime } from './format'

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
        <p className="hint">Result saved on this device.</p>

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
