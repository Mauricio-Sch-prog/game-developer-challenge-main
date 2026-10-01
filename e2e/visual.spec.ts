import { expect, test } from '@playwright/test'
import { advance, openApp, playUntilOver, startMatch } from './support'

// Baselines live next to this file (visual.spec.ts-snapshots/), one per project.
// After an intended visual change: npm run test:e2e:update
test.describe('visual regression', { tag: '@mobile' }, () => {
  test('main menu', async ({ page }) => {
    await openApp(page)
    await expect(page).toHaveScreenshot('menu.png')
  })

  test('arena in a stable state', async ({ page }) => {
    await openApp(page, { clock: 'manual' })
    await startMatch(page)
    // Seeded match on the test clock: the first Chaser is always at the same spot.
    await advance(page, 2.5)
    await expect(page).toHaveScreenshot('arena.png')
  })

  test('result screen', async ({ page }) => {
    await openApp(page, { clock: 'manual' })
    await startMatch(page)
    await playUntilOver(page)
    await expect(page.getByText('Saved to the ranking and your match history.')).toBeVisible()
    await expect(page).toHaveScreenshot('result.png')
  })
})
