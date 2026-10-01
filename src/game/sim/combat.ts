import { circlesOverlap, separateCircles } from './collision'
import type { Ship, World } from './types'

/**
 * Applies damage; returns true when this hit destroyed the ship.
 * `scores` is true only for player shots hitting enemies.
 */
function damageShip(world: World, ship: Ship, amount: number, scores: boolean): boolean {
  if (!ship.alive) return false
  ship.hp = Math.max(0, ship.hp - amount)
  if (ship.hp > 0) return false
  ship.alive = false
  if (scores) world.score += 1
  world.events.push({ type: 'destroyed', kind: ship.kind, x: ship.x, y: ship.y, angle: ship.angle, scored: scores })
  return true
}

/**
 * Projectile vs ship. Each projectile is marked dead on its first hit, so it
 * can never damage twice. Only enemies destroyed by the player score.
 */
export function resolveProjectileHits(world: World): void {
  const { player, enemies } = world

  for (const p of world.projectiles) {
    if (!p.alive) continue

    if (p.team === 'player') {
      for (const enemy of enemies) {
        if (!enemy.alive || !circlesOverlap(p, enemy)) continue
        p.alive = false
        world.events.push({ type: 'hit', x: p.x, y: p.y, radius: p.radius })
        damageShip(world, enemy, p.damage, true)
        break
      }
    } else if (player.alive && circlesOverlap(p, player)) {
      p.alive = false
      world.events.push({ type: 'hit', x: p.x, y: p.y, radius: p.radius })
      damageShip(world, player, p.damage, false)
    }
  }
}

/**
 * Ship vs ship. A Chaser touching the player explodes (no score) and deals
 * contact damage; any other overlap just pushes the ships apart.
 */
export function resolveShipContacts(world: World): void {
  const { player, enemies } = world
  const { contactDamage } = world.config.enemies.chaser

  for (const enemy of enemies) {
    if (!enemy.alive || !player.alive || !circlesOverlap(enemy, player)) continue
    if (enemy.kind === 'chaser') {
      // Self-destruction: bypasses damageShip so it never counts as a kill.
      enemy.alive = false
      world.events.push({ type: 'ram', x: enemy.x, y: enemy.y })
      world.events.push({ type: 'destroyed', kind: enemy.kind, x: enemy.x, y: enemy.y, angle: enemy.angle, scored: false })
      damageShip(world, player, contactDamage, false)
    } else {
      separateCircles(enemy, player, 0.7)
    }
  }

  // Keep enemies from stacking on top of each other (few ships: O(n²) is fine).
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i]
      const b = enemies[j]
      if (a.alive && b.alive && circlesOverlap(a, b)) separateCircles(a, b)
    }
  }
}
