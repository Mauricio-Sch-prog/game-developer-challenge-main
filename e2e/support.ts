import { expect, type Page } from '@playwright/test'
import type { World } from '../src/game/sim/types'

/** Plain-data copy of the simulation, as the test receives it (no functions). */
export type WorldState = Omit<World, 'random'>

export interface Point {
  x: number
  y: number
}

type Params = Record<string, string | undefined>

/**
 * Opens the app in test mode: test hooks on, a fixed match seed and instant
 * mock API answers. A param set to `undefined` drops that default.
 * Add `clock: 'manual'` to drive the match time with `advance`.
 */
export async function openApp(page: Page, params: Params = {}): Promise<void> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries({ test: '', seed: '2', mockLatency: '0', ...params })) {
    if (value !== undefined) search.set(key, value)
  }
  await page.goto(`/?${search}`)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
}

/** Waits until a match engine is mounted (assets loaded, test hooks installed). */
export async function waitForMatch(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__PIRATE_BATTLE__ !== undefined)
}

export async function startMatch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await waitForMatch(page)
}

export function readWorld(page: Page): Promise<WorldState> {
  return page.evaluate(() => {
    const hooks = window.__PIRATE_BATTLE__
    if (!hooks) throw new Error('No match is running (open the app with ?test)')
    // JSON round trip: plain data only (the seeded random function stays behind).
    return JSON.parse(JSON.stringify(hooks.getWorld())) as WorldState
  })
}

/** Test clock: plays `seconds` of match time (needs `clock: 'manual'`). */
export async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => window.__PIRATE_BATTLE__?.advance(s), seconds)
}

/** Holds a key with the real keyboard for `seconds` of match time. */
export async function hold(page: Page, key: string, seconds: number): Promise<void> {
  await page.keyboard.down(key)
  await advance(page, seconds)
  await page.keyboard.up(key)
}

export const angleTo = (from: Point, to: Point): number => Math.atan2(to.y - from.y, to.x - from.x)

export const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle))

/** Turns the player with the real A/D keys until it faces the target heading. */
export async function turnTo(page: Page, target: (world: WorldState) => number): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const world = await readWorld(page)
    const error = wrapAngle(target(world) - world.player.angle)
    const perFrame = world.config.player.turnSpeed / 60
    if (Math.abs(error) <= perFrame) return
    const frames = Math.round(Math.abs(error) / perFrame)
    await hold(page, error > 0 ? 'KeyD' : 'KeyA', frames / 60)
  }
  throw new Error('The ship did not reach the target heading')
}

/** Advances the test clock in 1 s steps until the match is over. */
export async function playUntilOver(page: Page, maxSeconds = 90): Promise<WorldState> {
  for (let elapsed = 0; elapsed < maxSeconds; elapsed++) {
    await advance(page, 1)
    const world = await readWorld(page)
    if (world.status === 'over') return world
  }
  throw new Error(`The match did not end within ${maxSeconds} s`)
}

/** Opens a scenario in Options → Network simulation, then returns to the menu. */
export async function selectScenario(page: Page, scenario: string): Promise<void> {
  await page.getByRole('button', { name: 'Options' }).click()
  await page.getByLabel('Scenario').selectOption(scenario)
  await page.getByRole('button', { name: 'Main Menu' }).click()
}
