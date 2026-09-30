import { Container, Sprite, Texture, TilingSprite } from 'pixi.js'
import type { GameConfig } from '../config'
import { islandTileBounds, type TileBounds } from '../sim/arena'

/** 9-slice tile ids, row by row: top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right. */
type NineSlice = readonly [number, number, number, number, number, number, number, number, number]

const SAND_ISLAND: NineSlice = [1, 2, 3, 17, 18, 19, 33, 34, 35]
const SHALLOW_WATER: NineSlice = [10, 11, 12, 26, 27, 28, 42, 43, 44]
const GRASS_ISLAND = [
  [6, 7, 8, 9],
  [22, 23, 24, 25],
  [38, 39, 40, 41],
  [54, 55, 56, 57],
] as const
const WATER_TILE = 73

/**
 * Static background: tiled water, a shallow-water halo and the islands.
 * Built once per match; it never changes, so it has no per-frame work.
 */
export class ArenaView extends Container {
  constructor(arena: GameConfig['arena']) {
    super()
    const { width, height, tileSize } = arena

    // TilingSprite repeats one texture over a large area in a single draw.
    this.addChild(new TilingSprite({ texture: Texture.from(`tile_${WATER_TILE}`), width, height }))

    for (const island of arena.islands) {
      const bounds = islandTileBounds(island)
      const halo = { col: bounds.col - 1, row: bounds.row - 1, cols: bounds.cols + 2, rows: bounds.rows + 2 }
      this.addNineSlice(SHALLOW_WATER, halo, tileSize)
    }

    for (const island of arena.islands) {
      const bounds = islandTileBounds(island)
      if (island.kind === 'grass') {
        GRASS_ISLAND.forEach((ids, r) =>
          ids.forEach((id, c) => this.addTile(id, bounds.col + c, bounds.row + r, tileSize)),
        )
      } else {
        this.addNineSlice(SAND_ISLAND, bounds, tileSize)
      }
    }
  }

  private addNineSlice(ids: NineSlice, { col, row, cols, rows }: TileBounds, tileSize: number): void {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const h = c === 0 ? 0 : c === cols - 1 ? 2 : 1
        const v = r === 0 ? 0 : r === rows - 1 ? 2 : 1
        this.addTile(ids[v * 3 + h], col + c, row + r, tileSize)
      }
    }
  }

  private addTile(id: number, col: number, row: number, tileSize: number): void {
    const tile = new Sprite(Texture.from(`tile_${id}`))
    tile.position.set(col * tileSize, row * tileSize)
    this.addChild(tile)
  }
}
