import type { SideWeaponConfig, WeaponConfig } from '../config'
import type { PlayerIntent, Ship, Team, World } from './types'

/** Muzzle positions relative to the ship center, matching the scaled ship art. */
const BOW_OFFSET = 42
const SIDE_OFFSET = 22

function spawnProjectile(world: World, team: Team, x: number, y: number, angle: number, weapon: WeaponConfig): void {
  world.projectiles.push({
    team,
    x,
    y,
    vx: Math.cos(angle) * weapon.projectileSpeed,
    vy: Math.sin(angle) * weapon.projectileSpeed,
    radius: world.config.projectile.radius,
    damage: weapon.damage,
    ttl: weapon.projectileLifetime,
    alive: true,
  })
  world.events.push({ type: 'shot', x, y, angle })
}

/** One projectile from the bow, in the heading direction. */
export function fireFront(world: World, ship: Ship, weapon: WeaponConfig, team: Team): void {
  const x = ship.x + Math.cos(ship.angle) * BOW_OFFSET
  const y = ship.y + Math.sin(ship.angle) * BOW_OFFSET
  spawnProjectile(world, team, x, y, ship.angle, weapon)
}

/**
 * `count` parallel projectiles, perpendicular to the hull.
 * side = -1 is port (left of the heading), side = 1 is starboard (right).
 */
export function fireBroadside(world: World, ship: Ship, weapon: SideWeaponConfig, side: -1 | 1, team: Team): void {
  const angle = ship.angle + side * (Math.PI / 2)
  const forwardX = Math.cos(ship.angle)
  const forwardY = Math.sin(ship.angle)
  const sideX = Math.cos(angle)
  const sideY = Math.sin(angle)

  for (let i = 0; i < weapon.count; i++) {
    // Spread the cannons along the hull, centered on the ship.
    const along = (i - (weapon.count - 1) / 2) * weapon.spacing
    const x = ship.x + forwardX * along + sideX * SIDE_OFFSET
    const y = ship.y + forwardY * along + sideY * SIDE_OFFSET
    spawnProjectile(world, team, x, y, angle, weapon)
  }
}

/**
 * Each weapon has its own cooldown. Cooldowns only tick inside the simulation
 * step, so they freeze automatically while the game is paused.
 */
export function updatePlayerWeapons(world: World, intent: PlayerIntent, dt: number): void {
  const { player, playerCooldowns: cd } = world
  const { frontCannon, sideCannons } = world.config.player

  cd.front = Math.max(0, cd.front - dt)
  cd.left = Math.max(0, cd.left - dt)
  cd.right = Math.max(0, cd.right - dt)

  if (intent.fireFront && cd.front === 0) {
    fireFront(world, player, frontCannon, 'player')
    cd.front = frontCannon.cooldown
  }
  if (intent.fireLeft && cd.left === 0) {
    fireBroadside(world, player, sideCannons, -1, 'player')
    cd.left = sideCannons.cooldown
  }
  if (intent.fireRight && cd.right === 0) {
    fireBroadside(world, player, sideCannons, 1, 'player')
    cd.right = sideCannons.cooldown
  }
}
