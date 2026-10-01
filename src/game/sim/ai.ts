import { circleIntersectsRect } from './collision'
import { wrapAngle } from './math'
import { moveShip, steerTowards } from './movement'
import type { Enemy, Ship, World } from './types'
import { fireFront } from './weapons'

/** How far ahead enemies look for islands. */
const PROBE_DISTANCE = 90

function angleTo(from: Ship, to: Ship): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

function distance(a: Ship, b: Ship): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * Very simple obstacle avoidance: if a point ahead of the bow is inside an
 * island, steer 90° away from the island center (left or right, whichever
 * side the island is not on). Ships then slide around it.
 */
function avoidIslands(ship: Ship, world: World, desiredAngle: number): number {
  const probe = {
    x: ship.x + Math.cos(ship.angle) * PROBE_DISTANCE,
    y: ship.y + Math.sin(ship.angle) * PROBE_DISTANCE,
    radius: ship.radius,
  }
  for (const island of world.islands) {
    if (!circleIntersectsRect(probe, island)) continue
    const toCenterX = island.x + island.width / 2 - ship.x
    const toCenterY = island.y + island.height / 2 - ship.y
    // Cross product > 0: the island is on the right (clockwise) side.
    const cross = Math.cos(ship.angle) * toCenterY - Math.sin(ship.angle) * toCenterX
    return ship.angle + (cross > 0 ? -1 : 1) * (Math.PI / 2)
  }
  return desiredAngle
}

/** Chaser: full speed towards the player. Ramming is handled by the combat step. */
function updateChaser(enemy: Enemy, world: World, dt: number): void {
  const stats = world.config.enemies.chaser
  const { player } = world
  let target = angleTo(enemy, player)
  // Close to the player it goes straight in, even along an island edge.
  if (distance(enemy, player) > PROBE_DISTANCE) target = avoidIslands(enemy, world, target)
  moveShip(enemy, stats, 1, steerTowards(enemy, stats, target, dt), dt)
}

/** Shooter: approaches until `preferredDistance`, aims with the bow, fires in range. */
function updateShooter(enemy: Enemy, world: World, dt: number): void {
  const stats = world.config.enemies.shooter
  const { player } = world
  const dist = distance(enemy, player)
  const aim = angleTo(enemy, player)
  const thrust = dist > stats.preferredDistance ? 1 : 0
  const target = thrust ? avoidIslands(enemy, world, aim) : aim
  moveShip(enemy, stats, thrust, steerTowards(enemy, stats, target, dt), dt)

  enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt)
  const aimError = Math.abs(wrapAngle(aim - enemy.angle))
  if (enemy.fireCooldown === 0 && dist <= stats.attackRange && aimError <= stats.aimTolerance) {
    fireFront(world, enemy, stats.cannon, 'enemy')
    enemy.fireCooldown = stats.cannon.cooldown
  }
}

export function updateEnemies(world: World, dt: number): void {
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue
    if (enemy.kind === 'chaser') updateChaser(enemy, world, dt)
    else updateShooter(enemy, world, dt)
  }
}
