import { Application, Container, type Ticker } from 'pixi.js'
import { GameAudio } from './audio/GameAudio'
import type { GameConfig } from './config'
import { InputManager, type Action, type Steering } from './input/InputManager'
import { ArenaView } from './render/ArenaView'
import { EffectsLayer } from './render/EffectsLayer'
import { EnemyLayer } from './render/EnemyLayer'
import { ProjectileLayer } from './render/ProjectileLayer'
import { ShipView } from './render/ShipView'
import type { GameStore, HudState } from './store/GameStore'
import type { World } from './sim/types'
import { createWorld, updateWorld } from './sim/world'
import { testHooksEnabled, type PirateBattleTestHooks } from './testHooks'

/**
 * Longest single simulation step. Slow frames are split into several steps,
 * so game time keeps up with real time even at low FPS, without big jumps
 * that would let projectiles tunnel through ships.
 */
const MAX_STEP = 1 / 30
/** Frame time above this is a hitch (tab stall, debugger) and is dropped. */
const MAX_FRAME_TIME = 0.25
const LETTERBOX_COLOR = '#0b2a3a'

/** HUD values for a fresh match, before the engine has run a single frame. */
export function initialHudState(config: GameConfig): HudState {
  return {
    hp: config.player.maxHp,
    maxHp: config.player.maxHp,
    score: 0,
    timeLeft: config.match.durationSeconds,
    timePlayed: 0,
    status: 'running',
    endReason: null,
  }
}

/**
 * Owns one match: the PixiJS Application, the simulation world and the input.
 *
 * Lifecycle: `new` → `mount(host)` (async) → ... → `destroy()`.
 * `destroy()` is safe to call at any time, even while `mount` is still
 * awaiting `app.init()` (this is what React StrictMode does on mount).
 */
export class GameEngine {
  private readonly config: GameConfig
  private readonly store: GameStore
  private readonly world: World
  private readonly input = new InputManager()
  private readonly audio = new GameAudio()
  /** The end-of-match sound plays once, on the frame the match ends. */
  private endHandled = false
  /** Everything in world coordinates; scaled to fit the screen. */
  private readonly worldLayer = new Container()
  private app: Application | null = null
  private playerView: ShipView | null = null
  private enemyLayer: EnemyLayer | null = null
  private projectileLayer: ProjectileLayer | null = null
  private effectsLayer: EffectsLayer | null = null
  private paused = false
  private destroyed = false
  private testHooks: PirateBattleTestHooks | null = null

  /** `seed` makes enemy spawns reproducible (same seed, same match). */
  constructor(config: GameConfig, store: GameStore, seed: number) {
    this.config = config
    this.store = store
    this.world = createWorld(config, seed)
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

    this.input.onPauseKey = this.togglePause
    this.input.attach(window)
    window.addEventListener('blur', this.pause)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    app.ticker.add(this.tick)
    this.audio.start()

    if (testHooksEnabled()) {
      this.testHooks = { getWorld: () => this.world }
      window.__PIRATE_BATTLE__ = this.testHooks
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.input.detach()
    this.audio.destroy()
    window.removeEventListener('blur', this.pause)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    if (this.testHooks && window.__PIRATE_BATTLE__ === this.testHooks) delete window.__PIRATE_BATTLE__

    const app = this.app
    if (!app) return
    this.app = null
    app.ticker.remove(this.tick)
    app.renderer.off('resize', this.layout)
    // Destroys the canvas and every display object. Textures are kept:
    // they live in the Assets cache and are reused by the next match.
    app.destroy({ removeView: true }, { children: true })
    this.playerView = null
    this.enemyLayer = null
    this.projectileLayer = null
    this.effectsLayer = null
  }

  /**
   * Stopping the ticker freezes everything that depends on time: the match
   * timer, cooldowns, movement and effects. Held keys are dropped.
   */
  readonly pause = (): void => {
    if (this.paused || !this.app || this.world.status !== 'running') return
    this.paused = true
    this.app.ticker.stop()
    this.input.setEnabled(false)
    this.audio.pause()
    this.store.update({ status: 'paused' })
  }

  /** Only called from an explicit player action (button or Esc/P). */
  readonly resume = (): void => {
    if (!this.paused || !this.app) return
    this.paused = false
    this.input.setEnabled(true)
    // Ticker.start() resets its clock, so the paused time is never simulated.
    this.app.ticker.start()
    this.audio.resume()
    this.store.update({ status: 'running' })
  }

  /** Virtual (touch) buttons feed the same input state as the keyboard. */
  readonly setAction = (action: Action, down: boolean): void => {
    this.input.setAction(action, down)
  }

  /** Touch joystick → steering direction and thrust (null when released). */
  readonly setSteering = (steering: Steering | null): void => {
    this.input.setSteering(steering)
  }

  private readonly togglePause = (): void => {
    if (this.paused) this.resume()
    else this.pause()
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) this.pause()
  }

  private buildScene(app: Application): void {
    this.playerView = new ShipView('player')
    this.enemyLayer = new EnemyLayer()
    this.projectileLayer = new ProjectileLayer()
    this.effectsLayer = new EffectsLayer()
    // Draw order: background, sinking wrecks, ships, cannonballs, effects on top.
    this.worldLayer.addChild(
      new ArenaView(this.config.arena),
      this.effectsLayer.wrecks,
      this.enemyLayer,
      this.playerView,
      this.projectileLayer,
      this.effectsLayer,
    )
    app.stage.addChild(this.worldLayer)
    this.syncViews(0)
  }

  /** Game loop, driven by the Pixi ticker (requestAnimationFrame). */
  private readonly tick = (ticker: Ticker): void => {
    const frameTime = Math.min(ticker.deltaMS / 1000, MAX_FRAME_TIME)
    const intent = this.input.readIntent()

    let remaining = frameTime
    while (remaining > 0) {
      const step = Math.min(remaining, MAX_STEP)
      updateWorld(this.world, intent, step)
      // Events only live for one step, so consume them right away.
      for (const event of this.world.events) {
        this.effectsLayer?.spawn(event)
        this.audio.handle(event)
      }
      remaining -= step
    }

    // Release the keyboard for the end-of-match dialog.
    if (this.world.status === 'over' && !this.endHandled) {
      this.endHandled = true
      this.input.setEnabled(false)
      if (this.world.endReason) this.audio.end(this.world.endReason)
    }
    this.audio.update(this.world)

    this.effectsLayer?.update(frameTime)
    this.syncViews(frameTime)
    this.publishHud()
  }

  /** Simulation → display objects. Pixi renders right after this, in the same tick. */
  private syncViews(dt: number): void {
    const { player, enemies, projectiles, elapsed } = this.world
    this.playerView?.sync(player, dt, elapsed)
    this.enemyLayer?.sync(enemies, dt, elapsed)
    this.projectileLayer?.sync(projectiles)
  }

  /** Simulation → React. Cheap to call every frame: the store ignores unchanged values. */
  private publishHud(): void {
    const { player, score, timeLeft, elapsed, status, endReason } = this.world
    this.store.update({
      hp: Math.ceil(player.hp),
      score,
      timeLeft: Math.ceil(timeLeft),
      timePlayed: Math.floor(elapsed),
      status: status === 'over' ? 'over' : this.paused ? 'paused' : 'running',
      endReason,
    })
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
    // The ticker is stopped while paused, so redraw once at the new size.
    if (this.paused) this.app?.render()
  }
}
