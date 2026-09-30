import { Container, Sprite, Texture } from 'pixi.js'
import type { Projectile } from '../sim/types'

/**
 * Draws every live projectile. Sprites are pooled: a projectile that dies
 * hands its sprite back, and the next shot reuses it instead of allocating.
 */
export class ProjectileLayer extends Container {
  private readonly active = new Map<Projectile, Sprite>()
  private readonly pool: Sprite[] = []
  private readonly texture = Texture.from('cannon_ball')

  sync(projectiles: readonly Projectile[]): void {
    // Release sprites of projectiles the simulation killed this step.
    for (const [projectile, sprite] of this.active) {
      if (!projectile.alive) {
        this.active.delete(projectile)
        sprite.visible = false
        this.pool.push(sprite)
      }
    }

    for (const projectile of projectiles) {
      let sprite = this.active.get(projectile)
      if (!sprite) {
        sprite = this.acquire()
        this.active.set(projectile, sprite)
      }
      sprite.position.set(projectile.x, projectile.y)
    }
  }

  private acquire(): Sprite {
    const pooled = this.pool.pop()
    if (pooled) {
      pooled.visible = true
      return pooled
    }
    const sprite = new Sprite(this.texture)
    sprite.anchor.set(0.5)
    this.addChild(sprite)
    return sprite
  }
}
