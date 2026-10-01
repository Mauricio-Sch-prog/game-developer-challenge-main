import { Container } from 'pixi.js'
import type { Enemy } from '../sim/types'
import { ShipView } from './ShipView'

/**
 * One ShipView per live enemy. Views are created when an enemy appears and
 * destroyed as soon as the simulation marks it dead (the explosion and the
 * sinking wreck are separate effects).
 */
export class EnemyLayer extends Container {
  private readonly views = new Map<Enemy, ShipView>()

  sync(enemies: readonly Enemy[], dt: number, time: number): void {
    for (const [enemy, view] of this.views) {
      if (!enemy.alive) {
        this.views.delete(enemy)
        view.destroy({ children: true })
      }
    }

    for (const enemy of enemies) {
      let view = this.views.get(enemy)
      if (!view) {
        view = new ShipView(enemy.kind)
        this.views.set(enemy, view)
        this.addChild(view)
      }
      view.sync(enemy, dt, time)
    }
  }
}
