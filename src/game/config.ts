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
  /** Collision radius of the projectile; the sprite is scaled to match. */
  projectileRadius: number
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

export type EnemyKind = 'chaser' | 'shooter'

export interface ChaserConfig extends ShipStats {
  /** Damage dealt to the player when it rams (and explodes). */
  contactDamage: number
}

export interface ShooterConfig extends ShipStats {
  /** Fires when the player is closer than this... */
  attackRange: number
  /** ...and stops approaching once closer than this. */
  preferredDistance: number
  /** Max heading error (radians) to open fire. */
  aimTolerance: number
  cannon: WeaponConfig
}

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
  enemies: {
    chaser: ChaserConfig
    shooter: ShooterConfig
  }
  spawn: {
    /** Seconds between spawns. */
    intervalSeconds: number
    /** Delay before the first enemy appears. */
    initialDelay: number
    /** Spawn order, repeated in a loop. Also defines the type distribution. */
    pattern: EnemyKind[]
    /**
     * After every `every` single spawns, the next spawn brings `size` enemies
     * at once, each at its own free spot. `size: 1` turns groups off.
     */
    group: { every: number; size: number }
    /** Enemies never appear closer than this to the player. */
    minDistanceFromPlayer: number
    /** A spawn is skipped while this many enemies are alive. */
    maxEnemies: number
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
    // Clearly faster than every enemy (Chaser 165, Shooter 110), so outrunning them is a real option.
    maxSpeed: 210,
    acceleration: 300,
    turnSpeed: 2.4,
    radius: 28,
    // Main weapon: heavy shot. One hit sinks a Chaser, two sink a Shooter.
    frontCannon: {
      cooldown: 0.4,
      damage: 30,
      projectileSpeed: 520,
      projectileLifetime: 1.2,
      projectileRadius: 9,
    },
    sideCannons: {
      cooldown: 1.5,
      damage: 15,
      projectileSpeed: 460,
      projectileLifetime: 0.9,
      projectileRadius: 5,
      count: 3,
      spacing: 22,
    },
  },
  enemies: {
    chaser: {
      maxHp: 30,
      maxSpeed: 165,
      acceleration: 220,
      turnSpeed: 2.2,
      radius: 26,
      contactDamage: 20,
    },
    shooter: {
      maxHp: 50,
      maxSpeed: 110,
      acceleration: 160,
      turnSpeed: 1.6,
      radius: 28,
      attackRange: 420,
      preferredDistance: 300,
      aimTolerance: 0.15,
      cannon: {
        cooldown: 2,
        damage: 8,
        projectileSpeed: 380,
        projectileLifetime: 1.3,
        projectileRadius: 5,
      },
    },
  },
  spawn: {
    intervalSeconds: 3,
    initialDelay: 2,
    pattern: ['chaser', 'shooter', 'chaser'],
    group: { every: 3, size: 2 },
    minDistanceFromPlayer: 450,
    maxEnemies: 10,
  },
}
