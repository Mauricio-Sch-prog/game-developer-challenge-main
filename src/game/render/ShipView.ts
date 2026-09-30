import { Container, Sprite, Texture } from 'pixi.js'
import type { Ship } from '../sim/types'
import { HealthBar, type HealthBarColor } from './HealthBar'

/**
 * Ship sprites (ships/ship_N.png) come in 6 colors (N = 1..6) and 4 wear
 * stages: ship_N (intact), N+6 (damaged), N+12 (badly damaged), N+18 (wreck).
 */
export type ShipColor = 1 | 2 | 3 | 4 | 5 | 6
const STAGE_OFFSET = 6

/** Ship art points its bow down (+y); the simulation's angle 0 points east (+x). */
const SPRITE_ROTATION_OFFSET = -Math.PI / 2
const SHIP_SCALE = 0.8
const HEALTH_BAR_OFFSET_Y = -62
const HEALTH_BAR_SCALE = 0.5

function wearStage(ship: Ship): number {
  if (!ship.alive) return 3
  const ratio = ship.hp / ship.maxHp
  if (ratio > 2 / 3) return 0
  if (ratio > 1 / 3) return 1
  return 2
}

/**
 * Visual representation of one simulated ship.
 * The root container only follows the position; the hull rotates, the health
 * bar does not (so it always stays readable above the ship).
 */
export class ShipView extends Container {
  private readonly hull = new Sprite()
  private readonly healthBar: HealthBar
  private readonly color: ShipColor
  private stage = -1

  constructor(color: ShipColor, barColor: HealthBarColor) {
    super()
    this.color = color
    this.hull.anchor.set(0.5) // rotate around the sprite center
    this.hull.scale.set(SHIP_SCALE)
    this.healthBar = new HealthBar(barColor)
    this.healthBar.scale.set(HEALTH_BAR_SCALE)
    this.healthBar.y = HEALTH_BAR_OFFSET_Y
    this.addChild(this.hull, this.healthBar)
  }

  /** Copies simulation state into the display objects. Called once per frame. */
  sync(ship: Ship): void {
    this.position.set(ship.x, ship.y)
    this.hull.rotation = ship.angle + SPRITE_ROTATION_OFFSET
    this.healthBar.setRatio(ship.hp / ship.maxHp)

    const stage = wearStage(ship)
    if (stage !== this.stage) {
      this.stage = stage
      this.hull.texture = Texture.from(`ship_${this.color + stage * STAGE_OFFSET}`)
    }
  }
}
