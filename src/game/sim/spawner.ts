import type { EnemyKind } from '../config'
import { circleIntersectsRect } from './collision'
import type { Enemy, World } from './types'

/** Retry soon when no free spot was found this time. */
const RETRY_DELAY = 0.25
const MAX_ATTEMPTS = 40
/** Extra clearance around islands and other ships. */
const CLEARANCE = 24

/**
 * Rejection sampling: pick random points until one is inside the arena,
 * away from islands and other enemies, and far enough from the player.
 */
function findSpawnPoint(world: World, radius: number): { x: number; y: number } | null {
  const { width, height } = world.config.arena
  const { minDistanceFromPlayer } = world.config.spawn
  const margin = radius + CLEARANCE
  const { player } = world

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const x = margin + world.random() * (width - margin * 2)
    const y = margin + world.random() * (height - margin * 2)
    const probe = { x, y, radius: radius + CLEARANCE }

    if (Math.hypot(x - player.x, y - player.y) < minDistanceFromPlayer) continue
    if (world.islands.some((island) => circleIntersectsRect(probe, island))) continue
    if (world.enemies.some((e) => Math.hypot(x - e.x, y - e.y) < probe.radius + e.radius)) continue
    return { x, y }
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

/** Spawns one enemy per interval, cycling through the configured pattern. */
export function updateSpawner(world: World, dt: number): void {
  world.spawnTimer -= dt
  if (world.spawnTimer > 0) return

  const { spawn } = world.config
  if (world.enemies.length >= spawn.maxEnemies) {
    world.spawnTimer = spawn.intervalSeconds // arena full: skip this one
    return
  }

  const kind = spawn.pattern[world.spawnCount % spawn.pattern.length]
  const point = findSpawnPoint(world, world.config.enemies[kind].radius)
  if (!point) {
    world.spawnTimer = RETRY_DELAY
    return
  }

  world.enemies.push(createEnemy(world, kind, point.x, point.y))
  world.spawnCount += 1
  world.spawnTimer = spawn.intervalSeconds
}
