import { Container, Sprite, Texture } from 'pixi.js'
import type { Ship, ShipKind } from '../sim/types'
import { HealthBar } from './HealthBar'

/**
 * Ship sprites (ships/ship_N.png) come in 6 colors (N = 1..6) and 4 wear
 * stages: ship_N (intact), N+6 (damaged), N+12 (badly damaged), N+18 (wreck).
 */
type ShipColor = 1 | 2 | 3 | 4 | 5 | 6
const STAGE_OFFSET = 6
const WRECK_STAGE = 3

/** 5 = blue (player), 2 = black skull (Chaser), 3 = red (Shooter). */
const SHIP_COLORS: Readonly<Record<ShipKind, ShipColor>> = { player: 5, chaser: 2, shooter: 3 }

/** Ship art points its bow down (+y); the simulation's angle 0 points east (+x). */
export const SPRITE_ROTATION_OFFSET = -Math.PI / 2
export const SHIP_SCALE = 0.8
const HEALTH_BAR_OFFSET_Y = -62
const HEALTH_BAR_SCALE = 0.5
const HIT_FLASH_SECONDS = 0.12
const HIT_TINT = 0xff7070

export function shipTexture(kind: ShipKind, stage: number): Texture {
  return Texture.from(`ship_${SHIP_COLORS[kind] + stage * STAGE_OFFSET}`)
}

export function wreckTexture(kind: ShipKind): Texture {
  return shipTexture(kind, WRECK_STAGE)
}

function wearStage(ship: Ship): number {
  if (!ship.alive) return WRECK_STAGE
  const ratio = ship.hp / ship.maxHp
  if (ratio > 2 / 3) return 0
  if (ratio > 1 / 3) return 1
  return 2
}

/**
 * Visual representation of one simulated ship.
 * The root container only follows the position; the hull rotates, the health
 * bar and the fire do not (so they always stay upright and readable).
 */
export class ShipView extends Container {
  private readonly kind: ShipKind
  private readonly hull = new Sprite()
  private readonly fire = new Sprite(Texture.from('fire_1'))
  private readonly healthBar: HealthBar
  private stage = -1
  private lastHp: number | null = null
  private flashTime = 0

  constructor(kind: ShipKind) {
    super()
    this.kind = kind
    this.hull.anchor.set(0.5) // rotate around the sprite center
    this.hull.scale.set(SHIP_SCALE)

    this.fire.anchor.set(0.5, 0.9)
    this.fire.visible = false

    this.healthBar = new HealthBar(kind === 'player' ? 'green' : 'red')
    this.healthBar.scale.set(HEALTH_BAR_SCALE)
    this.healthBar.y = HEALTH_BAR_OFFSET_Y
    this.addChild(this.hull, this.fire, this.healthBar)
  }

  /**
   * Copies simulation state into the display objects. Called once per frame.
   * `time` is the simulated time, used for small looping animations.
   */
  sync(ship: Ship, dt: number, time: number): void {
    this.position.set(ship.x, ship.y)
    this.hull.rotation = ship.angle + SPRITE_ROTATION_OFFSET
    this.healthBar.setRatio(ship.hp / ship.maxHp)
    this.healthBar.visible = ship.alive

    const stage = wearStage(ship)
    if (stage !== this.stage) {
      this.stage = stage
      this.hull.texture = shipTexture(this.kind, stage)
    }

    // Damage feedback: short red tint whenever HP dropped since last frame.
    if (this.lastHp !== null && ship.hp < this.lastHp) this.flashTime = HIT_FLASH_SECONDS
    this.lastHp = ship.hp
    this.flashTime = Math.max(0, this.flashTime - dt)
    this.hull.tint = this.flashTime > 0 ? HIT_TINT : 0xffffff

    // Burning below 1/3 HP: flicker between the two fire sprites.
    this.fire.visible = ship.alive && stage === 2
    if (this.fire.visible) {
      this.fire.texture = Texture.from(Math.sin(time * 20) > 0 ? 'fire_1' : 'fire_2')
      this.fire.scale.set(0.9 + 0.1 * Math.sin(time * 13))
    }
  }
}
