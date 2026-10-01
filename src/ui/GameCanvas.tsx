import { useEffect, useRef, type RefObject } from 'react'
import type { GameConfig } from '../game/config'
import { GameEngine } from '../game/GameEngine'
import type { GameStore } from '../game/store/GameStore'

interface GameCanvasProps {
  config: GameConfig
  seed: number
  store: GameStore
  /** Lets the surrounding UI send commands (pause/resume) to the running engine. */
  engineRef: RefObject<GameEngine | null>
  /** Called once the engine is mounted and running. */
  onReady: () => void
}

/**
 * The only bridge between React and PixiJS: React owns the host <div>,
 * the engine owns everything inside it. This component renders once per
 * match; the game loop never triggers React renders.
 */
export function GameCanvas({ config, seed, store, engineRef, onReady }: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const engine = new GameEngine(config, store, seed)
    engineRef.current = engine
    engine
      .mount(host)
      .then(() => {
        if (engineRef.current === engine) onReady()
      })
      .catch((error: unknown) => {
        console.error('Failed to start the game engine', error)
      })
    // Runs on unmount, and between the two mounts of React StrictMode.
    return () => {
      engine.destroy()
      if (engineRef.current === engine) engineRef.current = null
    }
  }, [config, seed, store, engineRef, onReady])

  return <div ref={hostRef} className="game-canvas" />
}
