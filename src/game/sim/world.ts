import type { GameConfig } from '../config'
import { islandHitbox } from './arena'
import { moveShip, resolveShipObstacles } from './movement'
import { updateProjectiles } from './projectiles'
import type { EndReason, PlayerIntent, World } from './types'
import { updatePlayerWeapons } from './weapons'

export function createWorld(config: GameConfig): World {
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
    projectiles: [],
    elapsed: 0,
    timeLeft: config.match.durationSeconds,
    score: 0,
    status: 'running',
    endReason: null,
    events: [],
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
  moveShip(player, world.config.player, intent.thrust ? 1 : 0, intent.turn, step)
  resolveShipObstacles(player, world)
  updatePlayerWeapons(world, intent, step)
  updateProjectiles(world, step)

  if (world.timeLeft <= 0) endMatch(world, 'time')
}
