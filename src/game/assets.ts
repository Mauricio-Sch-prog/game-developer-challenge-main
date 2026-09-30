import { Assets, type UnresolvedAsset } from 'pixi.js'

const BASE = `${import.meta.env.BASE_URL}png/default`

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

/** Tile ids (tiles/tile_N.png) used by the arena. See render/ArenaView.ts. */
const TILE_IDS = [
  ...range(1, 3), ...range(17, 19), ...range(33, 35), // sand island (9-slice)
  ...range(6, 9), ...range(22, 25), ...range(38, 41), ...range(54, 57), // grass island (4x4)
  ...range(10, 12), ...range(26, 28), ...range(42, 44), // shallow water halo (9-slice)
  73, // water
]

/**
 * Every texture the match needs, addressed by a short alias
 * (e.g. `Texture.from('ship_5')`). Loaded once and reused by every match.
 */
export const GAME_ASSETS: UnresolvedAsset[] = [
  ...range(1, 24).map((n) => ({ alias: `ship_${n}`, src: `${BASE}/ships/ship_${n}.png` })),
  ...TILE_IDS.map((n) => ({ alias: `tile_${n}`, src: `${BASE}/tiles/tile_${n}.png` })),
  ...range(1, 3).map((n) => ({ alias: `explosion_${n}`, src: `${BASE}/effects/explosion_${n}.png` })),
  ...range(1, 2).map((n) => ({ alias: `fire_${n}`, src: `${BASE}/effects/fire_${n}.png` })),
  { alias: 'cannon_ball', src: `${BASE}/ship_parts/cannon_ball.png` },
  ...['enemy_health_frame', 'enemy_health_fill_green', 'enemy_health_fill_red'].map((name) => ({
    alias: name,
    src: `${BASE}/ui/hud/${name}.png`,
  })),
]

type ProgressListener = (progress: number) => void

let pending: Promise<void> | null = null
let lastProgress = 0
const listeners = new Set<ProgressListener>()

/**
 * Loads the match textures. Concurrent callers (e.g. React StrictMode running
 * an effect twice) share the same request; a failed load can be retried.
 */
export function loadGameAssets(onProgress?: ProgressListener): Promise<void> {
  if (onProgress) {
    listeners.add(onProgress)
    onProgress(lastProgress)
  }

  pending ??= Assets.load(GAME_ASSETS, (progress) => {
    lastProgress = progress
    listeners.forEach((listener) => listener(progress))
  })
    .then(() => undefined)
    .catch((error: unknown) => {
      pending = null
      lastProgress = 0
      throw error
    })

  return pending.finally(() => {
    if (onProgress) listeners.delete(onProgress)
  })
}
