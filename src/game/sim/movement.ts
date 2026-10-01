import type { ShipStats } from '../config'
import { clampCircleToBounds, pushCircleOutOfRect } from './collision'
import { approach, clamp, wrapAngle } from './math'
import type { Ship, World } from './types'

/**
 * Ship movement model shared by the player and the enemies:
 * ships only move forward and rotate; speed ramps up/down with acceleration.
 * Everything is multiplied by `dt` (seconds), so it is frame-rate independent.
 */
export function moveShip(ship: Ship, stats: ShipStats, thrust: number, turn: number, dt: number): void {
  ship.angle = wrapAngle(ship.angle + turn * stats.turnSpeed * dt)
  ship.speed = approach(ship.speed, thrust * stats.maxSpeed, stats.acceleration * dt)
  ship.x += Math.cos(ship.angle) * ship.speed * dt
  ship.y += Math.sin(ship.angle) * ship.speed * dt
}

/**
 * Turn input (-1..1) that rotates `ship` towards `targetAngle`. Proportional:
 * full speed when far from the target, slower near it, so the ship settles
 * on the heading instead of wobbling around it.
 */
export function steerTowards(ship: Ship, stats: ShipStats, targetAngle: number, dt: number): number {
  const diff = wrapAngle(targetAngle - ship.angle)
  return clamp(diff / (stats.turnSpeed * dt), -1, 1)
}

/** Keeps a ship out of islands and inside the arena. */
export function resolveShipObstacles(ship: Ship, world: World): void {
  for (const island of world.islands) {
    pushCircleOutOfRect(ship, island)
  }
  clampCircleToBounds(ship, world.config.arena.width, world.config.arena.height)
}
