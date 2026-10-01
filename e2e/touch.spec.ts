import { expect, test } from '@playwright/test'
import { advance, openApp, readWorld, startMatch } from './support'

// Runs in the mobile project only (phone in landscape, real touch events).
test('fire buttons and the joystick control the ship', { tag: '@mobile' }, async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  await startMatch(page)

  const fire = page.getByRole('button', { name: 'Fire front cannon' })
  await expect(fire).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fire left broadside' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fire right broadside' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0) // landscape: no "rotate your device" pause

  // A quick tap, released before the next frame, still fires once.
  await fire.tap()
  await advance(page, 1 / 60)
  expect((await readWorld(page)).projectiles.filter((ball) => ball.team === 'player')).toHaveLength(1)

  // Drag the joystick to the right (east) and keep the finger there.
  const box = await page.locator('.joystick').boundingBox()
  if (!box) throw new Error('Joystick not found')
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const touch = await page.context().newCDPSession(page)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] })
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: center.x + box.width / 2, y: center.y }],
  })

  const before = await readWorld(page)
  await advance(page, 1.5)
  const after = await readWorld(page)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

  expect(after.player.angle).toBeCloseTo(0, 2) // turned from north to east
  expect(after.player.x - before.player.x).toBeGreaterThan(50)

  // Finger lifted: the ship stops accelerating.
  await advance(page, 1)
  expect((await readWorld(page)).player.speed).toBeLessThan(after.player.speed)
})
