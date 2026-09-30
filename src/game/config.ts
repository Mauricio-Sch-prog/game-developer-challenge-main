/**
 * Central, typed gameplay configuration.
 *
 * Balance changes should only touch this file, never the systems.
 * Units: distances in world pixels, times in seconds, angles in radians.
 */

export interface WeaponConfig {
  /** Minimum time between two shots of this weapon. */
  cooldown: number
  damage: number
  /** Projectile speed in px/s. */
  projectileSpeed: number
  /** Projectile time to live; range = speed * lifetime. */
  projectileLifetime: number
}

export interface SideWeaponConfig extends WeaponConfig {
  /** Parallel projectiles fired per side. */
  count: number
  /** Distance between parallel projectiles, measured along the hull. */
  spacing: number
}

export interface ShipStats {
  maxHp: number
  /** Top forward speed in px/s. */
  maxSpeed: number
  /** How fast the ship reaches (or leaves) its top speed, in px/s². */
  acceleration: number
  /** Rotation speed in rad/s. */
  turnSpeed: number
  /** Collision circle radius. */
  radius: number
}

/** Islands are laid out on the tile grid (col/row are tile coordinates). */
export type IslandConfig =
  | { kind: 'sand'; col: number; row: number; cols: number; rows: number }
  | { kind: 'grass'; col: number; row: number }

export interface GameConfig {
  arena: {
    width: number
    height: number
    tileSize: number
    /** Shrinks island hitboxes so the rounded sprite edges feel fair. */
    islandHitboxInset: number
    islands: IslandConfig[]
  }
  match: {
    durationSeconds: number
  }
  player: ShipStats & {
    frontCannon: WeaponConfig
    sideCannons: SideWeaponConfig
  }
  projectile: {
    radius: number
  }
}

export const DEFAULT_CONFIG: GameConfig = {
  arena: {
    width: 1600,
    height: 900,
    tileSize: 64,
    islandHitboxInset: 10,
    islands: [
      { kind: 'grass', col: 4, row: 3 },
      { kind: 'sand', col: 18, row: 2, cols: 3, rows: 2 },
      { kind: 'sand', col: 15, row: 9, cols: 5, rows: 3 },
      { kind: 'sand', col: 8, row: 10, cols: 2, rows: 2 },
    ],
  },
  match: {
    durationSeconds: 60,
  },
  player: {
    maxHp: 100,
    maxSpeed: 180,
    acceleration: 240,
    turnSpeed: 2.4,
    radius: 28,
    frontCannon: {
      cooldown: 0.4,
      damage: 20,
      projectileSpeed: 520,
      projectileLifetime: 1.2,
    },
    sideCannons: {
      cooldown: 1.5,
      damage: 15,
      projectileSpeed: 460,
      projectileLifetime: 0.9,
      count: 3,
      spacing: 22,
    },
  },
  projectile: {
    radius: 5,
  },
}
