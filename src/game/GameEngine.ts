import { Application, Container, type Ticker } from 'pixi.js'
import type { GameConfig } from './config'
import { InputManager } from './input/InputManager'
import { ArenaView } from './render/ArenaView'
import { ShipView } from './render/ShipView'
import type { World } from './sim/types'
import { createWorld, updateWorld } from './sim/world'

/** Longest step the simulation accepts; a long frame hitch never teleports ships. */
const MAX_FRAME_DT = 0.05
const LETTERBOX_COLOR = '#0b2a3a'

/**
 * Owns one match: the PixiJS Application, the simulation world and the input.
 *
 * Lifecycle: `new` → `mount(host)` (async) → ... → `destroy()`.
 * `destroy()` is safe to call at any time, even while `mount` is still
 * awaiting `app.init()` (this is what React StrictMode does on mount).
 */
export class GameEngine {
  private readonly config: GameConfig
  private readonly world: World
  private readonly input = new InputManager()
  /** Everything in world coordinates; scaled to fit the screen. */
  private readonly worldLayer = new Container()
  private app: Application | null = null
  private playerView: ShipView | null = null
  private destroyed = false

  constructor(config: GameConfig) {
    this.config = config
    this.world = createWorld(config)
  }

  async mount(host: HTMLElement): Promise<void> {
    const app = new Application()
    await app.init({
      resizeTo: host,
      background: LETTERBOX_COLOR,
      antialias: true,
      // Render at the device pixel density (capped for performance)...
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      // ...while keeping CSS size = host size.
      autoDensity: true,
    })

    if (this.destroyed) {
      // Unmounted while initializing: throw the new app away.
      app.destroy({ removeView: true }, { children: true })
      return
    }

    this.app = app
    host.appendChild(app.canvas)

    this.buildScene(app)
    app.renderer.on('resize', this.layout)
    this.layout(app.screen.width, app.screen.height)

    this.input.attach(window)
    app.ticker.add(this.tick)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.input.detach()

    const app = this.app
    if (!app) return
    this.app = null
    app.ticker.remove(this.tick)
    app.renderer.off('resize', this.layout)
    // Destroys the canvas and every display object. Textures are kept:
    // they live in the Assets cache and are reused by the next match.
    app.destroy({ removeView: true }, { children: true })
    this.playerView = null
  }

  private buildScene(app: Application): void {
    this.worldLayer.addChild(new ArenaView(this.config.arena))
    this.playerView = new ShipView(5, 'green')
    this.worldLayer.addChild(this.playerView)
    app.stage.addChild(this.worldLayer)
    this.syncViews()
  }

  /** Game loop, driven by the Pixi ticker (requestAnimationFrame). */
  private readonly tick = (ticker: Ticker): void => {
    const dt = Math.min(ticker.deltaMS / 1000, MAX_FRAME_DT)
    updateWorld(this.world, this.input.readIntent(), dt)
    this.syncViews()
  }

  /** Simulation → display objects. Pixi renders right after this, in the same tick. */
  private syncViews(): void {
    this.playerView?.sync(this.world.player)
  }

  /**
   * Fits the fixed-size arena in the screen, preserving its aspect ratio
   * (letterbox). The simulation never sees screen pixels.
   */
  private readonly layout = (screenWidth: number, screenHeight: number): void => {
    const { width, height } = this.config.arena
    const scale = Math.min(screenWidth / width, screenHeight / height)
    this.worldLayer.scale.set(scale)
    this.worldLayer.position.set((screenWidth - width * scale) / 2, (screenHeight - height * scale) / 2)
  }
}
