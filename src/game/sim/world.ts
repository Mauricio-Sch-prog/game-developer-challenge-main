import type { GameConfig } from '../config'
import { updateEnemies } from './ai'
import { islandHitbox } from './arena'
import { resolveProjectileHits, resolveShipContacts } from './combat'
import { moveShip, resolveShipObstacles } from './movement'
import { removeDead, updateProjectiles } from './projectiles'
import { createRandom } from './random'
import { updateSpawner } from './spawner'
import type { EndReason, PlayerIntent, World } from './types'
import { updatePlayerWeapons } from './weapons'

export function createWorld(config: GameConfig, seed: number): World {
  const { arena, player } = config
  return {
    config,
    islands: arena.islands.map((island) => islandHitbox(island, arena)),
    player: {
      id: 1,
      kind: 'player',
      x: arena.width / 2,
      y: arena.height / 2,
      angle: -Math.PI / 2, // facing north
      speed: 0,
      radius: player.radius,
      hp: player.maxHp,
      maxHp: player.maxHp,
      alive: true,
    },
    playerCooldowns: { front: 0, left: 0, right: 0 },
    enemies: [],
    projectiles: [],
    elapsed: 0,
    timeLeft: config.match.durationSeconds,
    score: 0,
    status: 'running',
    endReason: null,
    events: [],
    spawnTimer: config.spawn.initialDelay,
    spawnCount: 0,
    random: createRandom(seed),
    nextId: 2,
  }
}

function endMatch(world: World, reason: EndReason): void {
  world.status = 'over'
  world.endReason = reason
}

/**
 * Advances the simulation by `dt` seconds. The only entry point that mutates
 * the world, so the order of the systems below is the order of the rules.
 */
export function updateWorld(world: World, intent: PlayerIntent, dt: number): void {
  world.events.length = 0
  // After the end nothing moves, fires, takes damage, spawns or scores.
  if (world.status !== 'running') return

  // Never simulate past the end of the match.
  const step = Math.min(dt, world.timeLeft)
  world.timeLeft -= step
  // Derived instead of accumulated, so it is exact at the end (no float drift).
  world.elapsed = world.config.match.durationSeconds - world.timeLeft

  const { player } = world

  // 1. Movement (player input, enemy AI), then ship collisions.
  moveShip(player, world.config.player, intent.thrust ? 1 : 0, intent.turn, step)
  updateEnemies(world, step)
  resolveShipContacts(world)
  resolveShipObstacles(player, world)
  for (const enemy of world.enemies) resolveShipObstacles(enemy, world)

  // 2. Weapons and projectiles (Shooters fire inside updateEnemies).
  updatePlayerWeapons(world, intent, step)
  updateProjectiles(world, step)
  resolveProjectileHits(world)

  // 3. Clean up: destroyed things stop taking part in anything.
  removeDead(world.projectiles)
  removeDead(world.enemies)

  // 4. End conditions, then new enemies.
  if (!player.alive) {
    endMatch(world, 'death')
    return
  }
  if (world.timeLeft <= 0) {
    endMatch(world, 'time')
    return
  }
  updateSpawner(world, step)
}
