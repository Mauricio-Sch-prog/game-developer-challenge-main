import type { EnemyKind } from '../config'
import { circleIntersectsRect, type Circle } from './collision'
import type { Enemy, World } from './types'

/** Retry soon when no free spot was found this time. */
const RETRY_DELAY = 0.25
const MAX_ATTEMPTS = 40
/** Extra clearance around islands and other ships. */
const CLEARANCE = 24

/**
 * Rejection sampling: pick random points until one is inside the arena,
 * away from islands and other enemies, and far enough from the player.
 * `taken` holds the spots already picked for this same spawn, so the members
 * of a group never appear on top of each other.
 */
function findSpawnPoint(world: World, radius: number, taken: readonly Circle[]): Circle | null {
  const { width, height } = world.config.arena
  const { minDistanceFromPlayer } = world.config.spawn
  const margin = radius + CLEARANCE
  const { player } = world

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const x = margin + world.random() * (width - margin * 2)
    const y = margin + world.random() * (height - margin * 2)
    const probe = { x, y, radius: radius + CLEARANCE }
    const blocks = (ship: Circle) => Math.hypot(x - ship.x, y - ship.y) < probe.radius + ship.radius

    if (Math.hypot(x - player.x, y - player.y) < minDistanceFromPlayer) continue
    if (world.islands.some((island) => circleIntersectsRect(probe, island))) continue
    if (world.enemies.some(blocks) || taken.some(blocks)) continue
    return { x, y, radius }
  }
  return null
}

function createEnemy(world: World, kind: EnemyKind, x: number, y: number): Enemy {
  const stats = world.config.enemies[kind]
  return {
    id: world.nextId++,
    kind,
    x,
    y,
    // Spawn already facing the player.
    angle: Math.atan2(world.player.y - y, world.player.x - x),
    speed: 0,
    radius: stats.radius,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    alive: true,
    fireCooldown: 0,
  }
}

/**
 * One spawn per interval, cycling through the configured pattern. After every
 * `group.every` single spawns, the next one brings `group.size` enemies at once.
 */
export function updateSpawner(world: World, dt: number): void {
  world.spawnTimer -= dt
  if (world.spawnTimer > 0) return

  const { spawn } = world.config
  const { every, size } = spawn.group
  const wanted = world.spawnEvents % (every + 1) === every ? size : 1
  // Never more than `maxEnemies` alive: near the cap a group comes in smaller.
  const count = Math.min(wanted, spawn.maxEnemies - world.enemies.length)
  if (count <= 0) {
    world.spawnTimer = spawn.intervalSeconds // arena full: skip this one
    return
  }

  // Pick every spot before creating anyone: the group appears all together, or retries soon.
  const spots: (Circle & { kind: EnemyKind })[] = []
  for (let i = 0; i < count; i++) {
    const kind = spawn.pattern[(world.spawnCount + i) % spawn.pattern.length]
    const point = findSpawnPoint(world, world.config.enemies[kind].radius, spots)
    if (!point) {
      world.spawnTimer = RETRY_DELAY
      return
    }
    spots.push({ ...point, kind })
  }

  for (const spot of spots) world.enemies.push(createEnemy(world, spot.kind, spot.x, spot.y))
  world.spawnCount += count
  world.spawnEvents += 1
  world.spawnTimer = spawn.intervalSeconds
}
