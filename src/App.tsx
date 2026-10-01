import { useState } from 'react'
import { DEFAULT_CONFIG, type GameConfig } from './game/config'
import { GameScreen } from './ui/GameScreen'

interface Match {
  /** New id = new GameScreen instance = brand new engine (clean restart). */
  id: number
  /** Snapshot taken at start; later option changes only affect new matches. */
  config: GameConfig
  seed: number
}

/** `?seed=123` in the URL replays the same match (used by tests); random otherwise. */
function matchSeed(): number {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('seed'))
  return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : Math.floor(Math.random() * 2 ** 32)
}

export default function App() {
  const [match, setMatch] = useState<Match | null>(null)

  const play = () => setMatch({ id: Date.now(), config: structuredClone(DEFAULT_CONFIG), seed: matchSeed() })

  if (match) {
    return <GameScreen key={match.id} config={match.config} seed={match.seed} onRestart={play} onExit={() => setMatch(null)} />
  }

  // Temporary menu; replaced by the real screens on night 2.
  return (
    <main className="menu">
      <h1>Pirate Battle</h1>
      <button type="button" onClick={play} autoFocus>
        Play
      </button>
      <ul className="controls">
        <li>W / ↑: sail forward</li>
        <li>A D / ← →: turn</li>
        <li>Space: front cannon · Q / E: left / right broadside</li>
        <li>Esc / P: pause</li>
      </ul>
    </main>
  )
}
