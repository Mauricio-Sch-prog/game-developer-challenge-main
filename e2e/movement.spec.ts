import { expect, test } from '@playwright/test'
import type { Rect } from '../src/game/sim/collision'
import { advance, angleTo, hold, openApp, readWorld, startMatch, turnTo, type Point } from './support'

/** Distance from a point to the closest point of a rectangle (0 when inside). */
function distanceToRect(point: Point, rect: Rect): number {
  const x = Math.min(Math.max(point.x, rect.x), rect.x + rect.width)
  const y = Math.min(Math.max(point.y, rect.y), rect.y + rect.height)
  return Math.hypot(point.x - x, point.y - y)
}

test.beforeEach(async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  await startMatch(page)
})

test('sails forward and turns both ways', async ({ page }) => {
  const start = await readWorld(page)
  const turnSpeed = start.config.player.turnSpeed

  // The ship starts facing north (screen y grows downwards).
  await hold(page, 'KeyW', 1)
  const forward = await readWorld(page)
  expect(start.player.y - forward.player.y).toBeGreaterThan(100)
  expect(forward.player.x).toBeCloseTo(start.player.x, 6)

  await hold(page, 'KeyD', 0.5)
  const right = await readWorld(page)
  expect(right.player.angle - forward.player.angle).toBeCloseTo(turnSpeed * 0.5, 6)

  await hold(page, 'ArrowLeft', 0.5)
  const left = await readWorld(page)
  expect(left.player.angle).toBeCloseTo(forward.player.angle, 6)
})

test('stays inside the arena', async ({ page }) => {
  // Full speed north, straight into the top edge.
  await hold(page, 'KeyW', 4)
  const { player } = await readWorld(page)
  expect(player.y).toBe(player.radius)
})

test('islands block the ship', async ({ page }) => {
  const { islands } = await readWorld(page)
  const island = islands[0]
  const center = { x: island.x + island.width / 2, y: island.y + island.height / 2 }
  await turnTo(page, (world) => angleTo(world.player, center))

  let closest = Infinity
  await page.keyboard.down('KeyW')
  for (let i = 0; i < 30; i++) {
    await advance(page, 0.1)
    const { player } = await readWorld(page)
    const gap = distanceToRect(player, island)
    expect(gap).toBeGreaterThanOrEqual(player.radius - 1e-6) // never inside the island
    closest = Math.min(closest, gap)
  }
  await page.keyboard.up('KeyW')

  // It did reach the island, and was stopped right at its edge.
  const { player } = await readWorld(page)
  expect(closest).toBeLessThan(player.radius + 1)
})
