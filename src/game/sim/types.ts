import type { GameConfig } from '../config'
import type { Rect } from './collision'

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

/** What the player wants to do this frame, already decoupled from keyboard/touch. */
export interface PlayerIntent {
  thrust: boolean
  /** -1 = turn left (counter-clockwise), 1 = turn right, 0 = keep heading. */
  turn: -1 | 0 | 1
  fireFront: boolean
  fireLeft: boolean
  fireRight: boolean
}

export interface World {
  /** Snapshot of the configuration taken when the match started. */
  config: GameConfig
  islands: Rect[]
  player: Ship
  /** Simulated seconds since the match started (paused time is not counted). */
  elapsed: number
  nextId: number
}
