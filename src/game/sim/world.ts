import type { GameConfig } from '../config'
import { islandHitbox } from './arena'
import { moveShip, resolveShipObstacles } from './movement'
import type { PlayerIntent, World } from './types'

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
    elapsed: 0,
    nextId: 2,
  }
}

/** Advances the simulation by `dt` seconds. The only entry point that mutates the world. */
export function updateWorld(world: World, intent: PlayerIntent, dt: number): void {
  world.elapsed += dt

  const { player } = world
  moveShip(player, world.config.player, intent.thrust ? 1 : 0, intent.turn, dt)
  resolveShipObstacles(player, world)
}
