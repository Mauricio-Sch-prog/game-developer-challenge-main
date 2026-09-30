import { useEffect, useRef } from 'react'
import type { GameConfig } from '../game/config'
import { GameEngine } from '../game/GameEngine'

interface GameCanvasProps {
  config: GameConfig
}

/**
 * The only bridge between React and PixiJS: React owns the host <div>,
 * the engine owns everything inside it. This component renders once per
 * match; the game loop never triggers React renders.
 */
export function GameCanvas({ config }: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const engine = new GameEngine(config)
    engine.mount(host).catch((error: unknown) => {
      console.error('Failed to start the game engine', error)
    })
    // Runs on unmount, and between the two mounts of React StrictMode.
    return () => engine.destroy()
  }, [config])

  return <div ref={hostRef} className="game-canvas" />
}
