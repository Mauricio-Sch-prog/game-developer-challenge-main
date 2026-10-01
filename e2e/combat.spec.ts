import { expect, test } from '@playwright/test'
import { advance, angleTo, openApp, readWorld, startMatch, turnTo, type WorldState } from './support'

const playerBalls = (world: WorldState) => world.projectiles.filter((ball) => ball.team === 'player')

test('front cannon fires along the heading, respects its cooldown, and works while sailing', async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  await startMatch(page)
  // Face east: open water up to the edge, so no ball leaves the arena during the test.
  await turnTo(page, () => 0)
  const start = await readWorld(page)

  // Sail and hold fire for 1 s: the 0.4 s cooldown allows exactly 3 shots.
  await page.keyboard.down('KeyW')
  await page.keyboard.down('Space')
  await advance(page, 1)
  await page.keyboard.up('Space')
  await page.keyboard.up('KeyW')

  const world = await readWorld(page)
  expect(world.player.x - start.player.x).toBeGreaterThan(100)
  const balls = playerBalls(world)
  expect(balls).toHaveLength(3)
  for (const ball of balls) expect(Math.atan2(ball.vy, ball.vx)).toBeCloseTo(world.player.angle, 6)
})

test('each broadside fires three parallel balls and has its own cooldown', async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  await startMatch(page)
  const toWest = (world: WorldState) => playerBalls(world).filter((ball) => ball.vx < 0)
  const toEast = (world: WorldState) => playerBalls(world).filter((ball) => ball.vx > 0)

  // Facing north: Q fires to port (west), E to starboard (east).
  await page.keyboard.press('KeyQ')
  await advance(page, 1 / 60)
  let world = await readWorld(page)
  expect(toWest(world)).toHaveLength(3)
  expect(new Set(toWest(world).map((ball) => ball.y)).size).toBe(3) // side by side along the hull
  for (const ball of toWest(world)) expect(Math.abs(ball.vy)).toBeLessThan(1e-6)

  await page.keyboard.press('KeyE')
  await page.keyboard.press('KeyQ') // still cooling down
  await advance(page, 1 / 60)
  world = await readWorld(page)
  expect(toEast(world)).toHaveLength(3)
  expect(toWest(world)).toHaveLength(3)
})

test('a Chaser sunk by the front cannon scores exactly one point', async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  await startMatch(page)

  // With seed 2 the first enemy, a Chaser, appears at t = 2 s.
  await advance(page, 2.1)
  let world = await readWorld(page)
  expect(world.enemies.map((enemy) => enemy.kind)).toEqual(['chaser'])

  await turnTo(page, (current) => angleTo(current.player, current.enemies[0]))
  await page.keyboard.press('Space')
  for (let i = 0; i < 30 && world.score === 0; i++) {
    await advance(page, 0.05)
    world = await readWorld(page)
  }

  expect(world.score).toBe(1)
  expect(world.enemies).toHaveLength(0)
  expect(playerBalls(world)).toHaveLength(0) // the ball was removed on impact
  expect(world.player.hp).toBe(world.player.maxHp)
  await expect(page.getByLabel('Score 1', { exact: true })).toBeVisible()

  // Counted once: nothing changes while the wreck sinks.
  await advance(page, 1)
  expect((await readWorld(page)).score).toBe(1)
})

test('a Chaser rams and explodes without scoring; a Shooter fires once in range', async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  await startMatch(page)

  // The player stays idle. Watch every frame (the world before each frame holds the
  // events of the previous one) for the first ram and the first enemy shot.
  const seen = await page.evaluate(() => {
    const found = {
      ram: null as { damage: number; score: number; chasersLost: number } | null,
      shot: null as { distance: number; range: number } | null,
      cannonHits: 0,
    }
    let lastHp = Infinity
    let lastChasers = 0

    window.__PIRATE_BATTLE__?.advance(14, (world) => {
      const { player, enemies, config } = world
      const chasers = enemies.filter((enemy) => enemy.kind === 'chaser').length
      for (const event of world.events) {
        if (event.type === 'ram' && !found.ram) {
          found.ram = { damage: lastHp - player.hp, score: world.score, chasersLost: lastChasers - chasers }
        }
        if (event.type === 'shot' && event.team === 'enemy' && !found.shot) {
          const distances = enemies
            .filter((enemy) => enemy.kind === 'shooter')
            .map((enemy) => Math.hypot(enemy.x - player.x, enemy.y - player.y))
          found.shot = { distance: Math.min(...distances), range: config.enemies.shooter.attackRange }
        }
      }
      if (lastHp - player.hp === config.enemies.shooter.cannon.damage) found.cannonHits += 1
      lastHp = player.hp
      lastChasers = chasers
    })
    return found
  })

  const { contactDamage } = (await readWorld(page)).config.enemies.chaser
  expect(seen.ram).toEqual({ damage: contactDamage, score: 0, chasersLost: 1 })
  expect(seen.shot).not.toBeNull()
  expect(seen.shot!.distance).toBeLessThanOrEqual(seen.shot!.range)
  expect(seen.cannonHits).toBeGreaterThan(0)
})

test('enemies spawn at the interval saved in Options', async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  await page.evaluate(() =>
    localStorage.setItem('pirate-battle:options', JSON.stringify({ sessionSeconds: 60, spawnIntervalSeconds: 5 })),
  )
  await startMatch(page)
  const spawnsAt = async (seconds: number) => {
    const { elapsed } = await readWorld(page)
    await advance(page, seconds - elapsed)
    return (await readWorld(page)).spawnEvents
  }

  // The match took a snapshot of the saved options.
  expect((await readWorld(page)).config.spawn.intervalSeconds).toBe(5)
  // First spawn after the 2 s initial delay, then one every 5 s.
  expect(await spawnsAt(1.9)).toBe(0)
  expect(await spawnsAt(2.1)).toBe(1)
  expect(await spawnsAt(6.9)).toBe(1)
  expect(await spawnsAt(7.1)).toBe(2)
})
