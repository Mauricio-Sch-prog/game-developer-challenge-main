import type { EnemyKind, GameConfig } from '../config'
import type { Rect } from './collision'
import type { Random } from './random'

/**
 * Pure simulation state. Nothing in here knows about PixiJS or React:
 * the render layer reads it every frame, the UI reads a small summary of it.
 */

export type ShipKind = 'player' | 'chaser' | 'shooter'

export interface Ship {
  id: number
  kind: ShipKind
  x: number
  y: number
  /** Heading in radians. 0 points east (+x); positive turns clockwise (screen y grows down). */
  angle: number
  /** Current forward speed in px/s. */
  speed: number
  radius: number
  hp: number
  maxHp: number
  alive: boolean
}

export interface Enemy extends Ship {
  kind: EnemyKind
  /** Seconds until the Shooter can fire again (unused by the Chaser). */
  fireCooldown: number
}

/** Who fired a projectile: player shots only hit enemies and vice versa. */
export type Team = 'player' | 'enemy'

export interface Projectile {
  team: Team
  x: number
  y: number
  /** Velocity in px/s. */
  vx: number
  vy: number
  radius: number
  damage: number
  /** Seconds left before it falls into the water. */
  ttl: number
  /** Set to false the moment it hits something, so damage is applied only once. */
  alive: boolean
}

/** Seconds until each weapon can fire again (0 = ready). */
export interface WeaponCooldowns {
  front: number
  left: number
  right: number
}

/** What the player wants to do this frame, already decoupled from keyboard/touch. */
export interface PlayerIntent {
  /** 0 = no thrust, 1 = full speed (analog with the touch joystick). */
  thrust: number
  /** -1 = turn left (counter-clockwise), 1 = turn right, 0 = keep heading. Ignored when `heading` is set. */
  turn: number
  /** Absolute direction to steer towards (touch joystick), in radians. null = steer with `turn`. */
  heading: number | null
  fireFront: boolean
  fireLeft: boolean
  fireRight: boolean
}

export type MatchStatus = 'running' | 'over'
export type EndReason = 'time' | 'death'

/**
 * One-shot things that happened during a step. The render layer turns them
 * into visual effects (and later sounds); the simulation never draws.
 */
export type WeaponKind = 'front' | 'broadside'

export type GameEvent =
  | { type: 'shot'; team: Team; weapon: WeaponKind; x: number; y: number; angle: number; radius: number }
  | { type: 'splash'; x: number; y: number }
  | { type: 'impact'; x: number; y: number }
  | { type: 'hit'; x: number; y: number; radius: number }
  | { type: 'destroyed'; kind: ShipKind; x: number; y: number; angle: number; scored: boolean }
  /** A Chaser rammed the player (its explosion is a separate `destroyed`). */
  | { type: 'ram'; x: number; y: number }

export interface World {
  /** Snapshot of the configuration taken when the match started. */
  config: GameConfig
  islands: Rect[]
  player: Ship
  playerCooldowns: WeaponCooldowns
  enemies: Enemy[]
  projectiles: Projectile[]
  /** Simulated seconds since the match started (paused time is not counted). */
  elapsed: number
  timeLeft: number
  score: number
  status: MatchStatus
  endReason: EndReason | null
  /** Events of the last step only; cleared at the start of every step. */
  events: GameEvent[]
  /** Seconds until the next spawn attempt. */
  spawnTimer: number
  /** How many enemies were spawned (index into the spawn pattern). */
  spawnCount: number
  /** How many spawns happened, a group counting once (decides when the next group comes). */
  spawnEvents: number
  /** Seeded random source: same seed, same match. */
  random: Random
  nextId: number
}
