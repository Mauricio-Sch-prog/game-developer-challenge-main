import type { GameConfig, IslandConfig } from '../config'
import type { Rect } from './collision'

/** The grass island art is a fixed 4x4 tile block. */
export const GRASS_ISLAND_TILES = 4

export interface TileBounds {
  col: number
  row: number
  cols: number
  rows: number
}

export function islandTileBounds(island: IslandConfig): TileBounds {
  if (island.kind === 'grass') {
    return { col: island.col, row: island.row, cols: GRASS_ISLAND_TILES, rows: GRASS_ISLAND_TILES }
  }
  return island
}

/** Collision rectangle of an island in world pixels. */
export function islandHitbox(island: IslandConfig, arena: GameConfig['arena']): Rect {
  const { col, row, cols, rows } = islandTileBounds(island)
  const size = arena.tileSize
  const inset = arena.islandHitboxInset
  return {
    x: col * size + inset,
    y: row * size + inset,
    width: cols * size - inset * 2,
    height: rows * size - inset * 2,
  }
}
