import { AnimatedSprite, Container, type DestroyOptions, Graphics, GraphicsContext, Sprite, Texture } from 'pixi.js'
import type { GameEvent, ShipKind } from '../sim/types'
import { SHIP_SCALE, SPRITE_ROTATION_OFFSET, wreckTexture } from './ShipView'

interface VisualEffect {
  display: Container
  age: number
  duration: number
  /** Animates the effect; `t` goes from 0 to 1 over its duration. */
  animate: (t: number) => void
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

/** Projectile radius the flash sizes below were tuned for; bigger shots get bigger flashes. */
const BASE_PROJECTILE_RADIUS = 5

/**
 * Short-lived visual feedback (muzzle flash, splash, hits, explosions).
 * Purely cosmetic: it reacts to simulation events and never affects the rules.
 * Everything is animated from `update(dt)`, so effects freeze while paused.
 */
export class EffectsLayer extends Container {
  /** Sinking wrecks go here; the engine places this layer below the ships. */
  readonly wrecks = new Container()
  private readonly running: VisualEffect[] = []
  /** One ring geometry shared by every splash (each Graphics only references it). */
  private readonly ring = new GraphicsContext().circle(0, 0, 10).stroke({ width: 3, color: 0xffffff })

  spawn(event: GameEvent): void {
    switch (event.type) {
      case 'shot':
        this.addFlash(event.x, event.y, 0.3, 0.55, 0.18, event.radius / BASE_PROJECTILE_RADIUS)
        break
      case 'impact':
        this.addFlash(event.x, event.y, 0.4, 0.7, 0.3)
        break
      case 'splash':
        this.addSplash(event.x, event.y)
        break
      case 'hit':
        this.addFlash(event.x, event.y, 0.45, 0.8, 0.25, event.radius / BASE_PROJECTILE_RADIUS)
        break
      case 'destroyed':
        // The player's own view turns into the wreck; enemy views are removed.
        if (event.kind !== 'player') this.addWreck(event.kind, event.x, event.y, event.angle)
        this.addExplosion(event.x, event.y)
        break
    }
  }

  update(dt: number): void {
    let write = 0
    for (const effect of this.running) {
      effect.age += dt
      const t = effect.age / effect.duration
      if (t >= 1) {
        effect.display.destroy()
        continue
      }
      effect.animate(t)
      this.running[write++] = effect
    }
    this.running.length = write
  }

  override destroy(options?: DestroyOptions): void {
    super.destroy(options)
    this.running.length = 0
    this.ring.destroy()
  }

  private addFlash(x: number, y: number, fromScale: number, toScale: number, duration: number, size = 1): void {
    const flash = new Sprite(Texture.from('explosion_3'))
    flash.anchor.set(0.5)
    flash.position.set(x, y)
    flash.rotation = Math.random() * Math.PI * 2
    this.add(flash, duration, (t) => {
      flash.scale.set(lerp(fromScale, toScale, t) * size)
      flash.alpha = 1 - t
    })
  }

  private addSplash(x: number, y: number): void {
    const splash = new Graphics(this.ring)
    splash.position.set(x, y)
    this.add(splash, 0.45, (t) => {
      splash.scale.set(lerp(0.4, 1.6, t))
      splash.alpha = 0.8 * (1 - t)
    })
  }

  /**
   * Plays explosion_3 → 2 → 1 (small to big), then fades. `autoUpdate: false`
   * keeps it off the global ticker, so it stops while the game is paused.
   */
  private addExplosion(x: number, y: number): void {
    const textures = [3, 2, 1].map((n) => Texture.from(`explosion_${n}`))
    const explosion = new AnimatedSprite({ textures, autoUpdate: false })
    explosion.anchor.set(0.5)
    explosion.position.set(x, y)
    this.add(explosion, 0.6, (t) => {
      explosion.gotoAndStop(Math.min(textures.length - 1, Math.floor(t * 2 * textures.length)))
      explosion.scale.set(lerp(0.8, 1.4, t))
      explosion.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2
    })
  }

  private addWreck(kind: ShipKind, x: number, y: number, angle: number): void {
    const wreck = new Sprite(wreckTexture(kind))
    wreck.anchor.set(0.5)
    wreck.position.set(x, y)
    wreck.rotation = angle + SPRITE_ROTATION_OFFSET
    this.add(
      wreck,
      1.6,
      (t) => {
        wreck.scale.set(SHIP_SCALE * lerp(1, 0.75, t))
        wreck.alpha = 1 - t
      },
      this.wrecks,
    )
  }

  private add(display: Container, duration: number, animate: (t: number) => void, parent: Container = this): void {
    animate(0)
    parent.addChild(display)
    this.running.push({ display, age: 0, duration, animate })
  }
}
