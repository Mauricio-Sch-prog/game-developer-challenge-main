import { expect, test } from '@playwright/test'
import { formatTime } from '../src/ui/format'
import { advance, openApp, playUntilOver, readWorld, startMatch, waitForMatch } from './support'

test('ends by time after a full match, then shows the result', async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  await startMatch(page)

  // A small keyboard bot plays the whole match: it turns to the nearest enemy
  // with A/D and holds Space while aimed. Keys go through the game's real listeners.
  await page.evaluate(() => {
    const held = new Set<string>()
    const key = (code: string, down: boolean) => {
      if (held.has(code) === down) return
      if (down) held.add(code)
      else held.delete(code)
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }))
    }
    window.__PIRATE_BATTLE__?.advance(62, ({ player, enemies, config }) => {
      let error = 0
      let nearest = Infinity
      for (const enemy of enemies) {
        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y)
        if (distance >= nearest) continue
        nearest = distance
        const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x) - player.angle
        error = Math.atan2(Math.sin(angle), Math.cos(angle))
      }
      const step = config.player.turnSpeed / 60
      key('KeyA', error < -step)
      key('KeyD', error > step)
      key('Space', nearest < Infinity && Math.abs(error) < 0.1)
    })
    for (const code of held) key(code, false)
  })

  const end = await readWorld(page)
  expect(end.status).toBe('over')
  expect(end.endReason).toBe('time')
  expect(end.elapsed).toBe(60)
  expect(end.score).toBeGreaterThan(0)

  await expect(page.getByRole('status').filter({ hasText: "Time's up!" })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Battle Complete' })).toBeVisible()
  await expect(page.locator('.result-score')).toContainText(String(end.score))
  await expect(page.getByText('01:00 played · Time up')).toBeVisible()
})

test(
  'ends by death, freezes the simulation, keeps the result after a refresh and restarts clean',
  { tag: '@mobile' },
  async ({ page }) => {
    await openApp(page, { clock: 'manual' })
    await startMatch(page)

    const end = await playUntilOver(page) // an idle ship is sunk by the enemies
    expect(end.endReason).toBe('death')
    expect(end.player.hp).toBe(0)

    // After the end nothing moves, fires, takes damage, spawns or scores, even with keys held.
    await page.keyboard.down('KeyW')
    await page.keyboard.down('Space')
    await advance(page, 3)
    await page.keyboard.up('Space')
    await page.keyboard.up('KeyW')
    const after = await readWorld(page)
    expect(after.elapsed).toBe(end.elapsed)
    expect(after.score).toBe(end.score)
    expect(after.spawnEvents).toBe(end.spawnEvents)
    expect(after.player).toEqual(end.player)
    expect(after.enemies).toEqual(end.enemies)
    expect(after.projectiles).toEqual(end.projectiles)

    await expect(page.getByRole('status').filter({ hasText: 'Your ship sank!' })).toBeVisible()
    const meta = `${formatTime(Math.floor(end.elapsed))} played · Ship destroyed`
    await expect(page.getByRole('heading', { name: 'Ship Sunk' })).toBeVisible()
    await expect(page.getByText(meta)).toBeVisible()
    await expect(page.getByText('Saved to the ranking and your match history.')).toBeVisible()

    // The last result survives a refresh.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Ship Sunk' })).toBeVisible()
    await expect(page.getByText(meta)).toBeVisible()

    // Play Again: a brand new match.
    await page.getByRole('button', { name: 'Play Again' }).click()
    await waitForMatch(page)
    const fresh = await readWorld(page)
    expect(fresh.status).toBe('running')
    expect(fresh.elapsed).toBe(0)
    expect(fresh.timeLeft).toBe(fresh.config.match.durationSeconds)
    expect(fresh.score).toBe(0)
    expect(fresh.player.hp).toBe(fresh.player.maxHp)
    expect(fresh.enemies).toHaveLength(0)
    expect(fresh.projectiles).toHaveLength(0)
    await expect(page.getByLabel('Score 0', { exact: true })).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(1)
  },
)

test('pause freezes the match, and resuming does not catch up', async ({ page }) => {
  await openApp(page) // real-time clock
  await startMatch(page)
  await page.keyboard.down('KeyW') // sailing when the pause comes
  await page.waitForFunction(() => (window.__PIRATE_BATTLE__?.getWorld().elapsed ?? 0) > 0.5)

  await page.keyboard.press('Escape')
  const dialog = page.getByRole('dialog', { name: 'Paused' })
  await expect(dialog).toBeVisible()
  const paused = await readWorld(page)

  // Real time passes; the match does not. Game keys are ignored while paused
  // (Q: Space would press the focused Resume button, which is a real resume).
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(1000)
  const still = await readWorld(page)
  expect(still.elapsed).toBe(paused.elapsed)
  expect(still.timeLeft).toBe(paused.timeLeft)
  expect(still.player).toEqual(paused.player)
  expect(still.playerCooldowns).toEqual(paused.playerCooldowns)
  await page.keyboard.up('KeyW')

  // Resume, then compare match time gained with real time since the click:
  // catching up on the paused second would make the match run ahead of the clock.
  const { gained, realSeconds } = await page.evaluate(async () => {
    const world = () => window.__PIRATE_BATTLE__!.getWorld()
    const before = world().elapsed
    const start = performance.now()
    Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent === 'Resume')!
      .click()
    await new Promise((resolve) => setTimeout(resolve, 300))
    return { gained: world().elapsed - before, realSeconds: (performance.now() - start) / 1000 }
  })
  await expect(dialog).toBeHidden()
  expect(gained).toBeGreaterThan(0)
  expect(gained).toBeLessThanOrEqual(realSeconds + 0.02)
  // Nothing fired from the key pressed during the pause.
  expect((await readWorld(page)).projectiles.filter((ball) => ball.team === 'player')).toHaveLength(0)
})

test('losing focus or hiding the tab pauses until the player resumes', async ({ page }) => {
  await openApp(page)
  await startMatch(page)
  const dialog = page.getByRole('dialog', { name: 'Paused' })

  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape') // keyboard resume
  await expect(dialog).toBeHidden()

  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })
      document.dispatchEvent(new Event('visibilitychange'))
    }, hidden)
  await setHidden(true)
  await expect(dialog).toBeVisible()
  // Coming back to the tab does not resume by itself.
  await setHidden(false)
  await page.waitForTimeout(300)
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(dialog).toBeHidden()
})

test('leaving or refreshing a match abandons it; repeated cycles leave one canvas', async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  const noMatch = () => page.evaluate(() => window.__PIRATE_BATTLE__ === undefined)

  for (let round = 0; round < 3; round++) {
    await startMatch(page)
    await expect(page.locator('canvas')).toHaveCount(1)
    await advance(page, 3)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await expect(page.locator('canvas')).toHaveCount(0)
    expect(await noMatch()).toBe(true)
  }

  // A refresh during a match also abandons it.
  await startMatch(page)
  await advance(page, 3)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()

  // Nothing was saved or registered for the abandoned matches.
  expect(await page.evaluate(() => localStorage.getItem('pirate-battle:last-result'))).toBeNull()
  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(page.getByText('No battles recorded yet.')).toBeVisible()
  await expect(page.getByText(/waiting to be saved/)).toHaveCount(0)
})
