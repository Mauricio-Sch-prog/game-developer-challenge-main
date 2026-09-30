import { Container, type DestroyOptions, Graphics, GraphicsContext, Sprite, Texture } from 'pixi.js'
import type { GameEvent } from '../sim/types'

interface VisualEffect {
  display: Container
  age: number
  duration: number
  /** Animates the effect; `t` goes from 0 to 1 over its duration. */
  animate: (t: number) => void
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

/**
 * Short-lived visual feedback (muzzle flash, water splash, impact puff).
 * Purely cosmetic: it reacts to simulation events and never affects the rules.
 */
export class EffectsLayer extends Container {
  private readonly running: VisualEffect[] = []
  /** One ring geometry shared by every splash (each Graphics only references it). */
  private readonly ring = new GraphicsContext().circle(0, 0, 10).stroke({ width: 3, color: 0xffffff })

  spawn(event: GameEvent): void {
    switch (event.type) {
      case 'shot':
        this.addFlash(event.x, event.y, 0.3, 0.55, 0.18)
        break
      case 'impact':
        this.addFlash(event.x, event.y, 0.4, 0.7, 0.3)
        break
      case 'splash':
        this.addSplash(event.x, event.y)
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

  private addFlash(x: number, y: number, fromScale: number, toScale: number, duration: number): void {
    const flash = new Sprite(Texture.from('explosion_3'))
    flash.anchor.set(0.5)
    flash.position.set(x, y)
    flash.rotation = Math.random() * Math.PI * 2
    this.add(flash, duration, (t) => {
      flash.scale.set(lerp(fromScale, toScale, t))
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

  private add(display: Container, duration: number, animate: (t: number) => void): void {
    animate(0)
    this.addChild(display)
    this.running.push({ display, age: 0, duration, animate })
  }
}
