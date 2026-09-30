import { useEffect, useState } from 'react'
import { loadGameAssets } from '../game/assets'
import type { GameConfig } from '../game/config'
import { GameCanvas } from './GameCanvas'

type LoadState =
  | { status: 'loading'; progress: number }
  | { status: 'ready' }
  | { status: 'error' }

interface GameScreenProps {
  config: GameConfig
  onExit: () => void
}

/** Loads the match assets (with progress and retry), then mounts the arena. */
export function GameScreen({ config, onExit }: GameScreenProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading', progress: 0 })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadGameAssets((progress) => {
      if (!cancelled) setLoad({ status: 'loading', progress })
    })
      .then(() => {
        if (!cancelled) setLoad({ status: 'ready' })
      })
      .catch((error: unknown) => {
        console.error('Failed to load game assets', error)
        if (!cancelled) setLoad({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = () => {
    setLoad({ status: 'loading', progress: 0 })
    setAttempt((n) => n + 1)
  }

  return (
    <div className="game-screen">
      {load.status === 'ready' && <GameCanvas config={config} />}

      {load.status === 'loading' && (
        <div className="overlay" role="status">
          <p>Loading assets… {Math.round(load.progress * 100)}%</p>
          <progress max={1} value={load.progress} />
        </div>
      )}

      {load.status === 'error' && (
        <div className="overlay" role="alert">
          <p>Could not load the game assets.</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
          <button type="button" onClick={onExit}>
            Main Menu
          </button>
        </div>
      )}

      <button type="button" className="exit-button" onClick={onExit}>
        Menu
      </button>
    </div>
  )
}
