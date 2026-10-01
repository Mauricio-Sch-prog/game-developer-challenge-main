import { useCallback, useEffect, useRef, useState } from 'react'
import { loadGameAssets } from '../game/assets'
import type { GameConfig } from '../game/config'
import { initialHudState, type GameEngine } from '../game/GameEngine'
import { GameStore } from '../game/store/GameStore'
import { GameCanvas } from './GameCanvas'
import { Hud } from './Hud'
import { MatchOverlay, type MatchSummary } from './MatchOverlay'
import { TouchControls } from './TouchControls'
import { TOUCH_PORTRAIT_QUERY, TOUCH_QUERY, useMediaQuery } from './useMediaQuery'

type LoadState =
  | { status: 'loading'; progress: number }
  | { status: 'ready' }
  | { status: 'error' }

interface GameScreenProps {
  config: GameConfig
  seed: number
  /** Called once when the match ends (not when it is abandoned). */
  onFinish: (summary: MatchSummary) => void
  onExit: () => void
}

/** Loads the match assets (with progress and retry), then mounts the arena and its UI. */
export function GameScreen({ config, seed, onFinish, onExit }: GameScreenProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading', progress: 0 })
  const [attempt, setAttempt] = useState(0)
  // One store and one engine per match (a restart remounts this whole screen).
  const [store] = useState(() => new GameStore(initialHudState(config)))
  const engineRef = useRef<GameEngine | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  // Must stay stable: a new function would re-run the canvas effect (new engine).
  const handleReady = useCallback(() => setEngineReady(true), [])
  const isTouch = useMediaQuery(TOUCH_QUERY)
  const isPortrait = useMediaQuery(TOUCH_PORTRAIT_QUERY)

  // Mobile plays in landscape: turning the phone to portrait pauses the match.
  useEffect(() => {
    if (engineReady && isPortrait) engineRef.current?.pause()
  }, [engineReady, isPortrait])

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
          <GameCanvas config={config} seed={seed} store={store} engineRef={engineRef} onReady={handleReady} />
          <Hud store={store} onPause={() => engineRef.current?.pause()} />
          {isTouch && (
            <TouchControls
              onAction={(action, down) => engineRef.current?.setAction(action, down)}
              onSteer={(steering) => engineRef.current?.setSteering(steering)}
            />
          )}
          <MatchOverlay
            store={store}
            rotateHint={isPortrait}
            onResume={() => engineRef.current?.resume()}
            onExit={onExit}
            onFinish={onFinish}
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
          <button type="button" className="btn btn-primary" onClick={retry} autoFocus>
            Retry
          </button>
          <button type="button" className="btn btn-secondary" onClick={onExit}>
            Main Menu
          </button>
        </div>
      )}
    </div>
  )
}
