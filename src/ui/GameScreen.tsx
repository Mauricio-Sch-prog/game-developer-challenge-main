import { useEffect, useRef, useState } from 'react'
import { loadGameAssets } from '../game/assets'
import type { GameConfig } from '../game/config'
import { initialHudState, type GameEngine } from '../game/GameEngine'
import { GameStore } from '../game/store/GameStore'
import { GameCanvas } from './GameCanvas'
import { Hud } from './Hud'
import { MatchOverlay } from './MatchOverlay'

type LoadState =
  | { status: 'loading'; progress: number }
  | { status: 'ready' }
  | { status: 'error' }

interface GameScreenProps {
  config: GameConfig
  seed: number
  onRestart: () => void
  onExit: () => void
}

/** Loads the match assets (with progress and retry), then mounts the arena and its UI. */
export function GameScreen({ config, seed, onRestart, onExit }: GameScreenProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading', progress: 0 })
  const [attempt, setAttempt] = useState(0)
  // One store and one engine per match (a restart remounts this whole screen).
  const [store] = useState(() => new GameStore(initialHudState(config)))
  const engineRef = useRef<GameEngine | null>(null)

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
      {load.status === 'ready' && (
        <>
          <GameCanvas config={config} seed={seed} store={store} engineRef={engineRef} />
          <Hud store={store} onPause={() => engineRef.current?.pause()} />
          <MatchOverlay
            store={store}
            onResume={() => engineRef.current?.resume()}
            onRestart={onRestart}
            onExit={onExit}
          />
        </>
      )}

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
          <button type="button" className="secondary" onClick={onExit}>
            Main Menu
          </button>
        </div>
      )}
    </div>
  )
}
