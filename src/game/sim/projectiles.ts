import { circleIntersectsRect, isOutsideBounds } from './collision'
import type { World } from './types'

/** Removes dead entries in place (no new array per frame). */
export function removeDead<T extends { alive: boolean }>(list: T[]): void {
  let write = 0
  for (const item of list) {
    if (item.alive) list[write++] = item
  }
  list.length = write
}

/**
 * Moves projectiles and removes the ones that expired, left the arena or hit
 * an island. Hits against ships are resolved in the combat step.
 */
export function updateProjectiles(world: World, dt: number): void {
  const { width, height } = world.config.arena

  for (const p of world.projectiles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.ttl -= dt

    if (p.ttl <= 0) {
      p.alive = false
      world.events.push({ type: 'splash', x: p.x, y: p.y })
    } else if (isOutsideBounds(p, width, height)) {
      p.alive = false
    } else if (world.islands.some((island) => circleIntersectsRect(p, island))) {
      p.alive = false
      world.events.push({ type: 'impact', x: p.x, y: p.y })
    }
  }

  removeDead(world.projectiles)
}
