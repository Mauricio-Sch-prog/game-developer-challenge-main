import { expect, test } from '@playwright/test'
import { openApp, waitForMatch } from './support'

test('shows loading progress, then an error with a working retry', async ({ page, context }) => {
  let requests = 0
  // Context-level route: asset requests pass through the MSW service worker.
  await context.route('**/png/default/ships/ship_5.png', async (route) => {
    requests += 1
    if (requests > 1) return route.continue()
    // Keep the first load hanging for a moment so the progress is visible, then fail it.
    await new Promise((resolve) => setTimeout(resolve, 500))
    return route.abort()
  })

  await openApp(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Loading assets' })).toBeVisible()
  await expect(page.getByRole('progressbar')).toBeVisible()

  await expect(page.getByRole('alert')).toContainText('Could not load the game assets.')
  await expect(page.locator('canvas')).toHaveCount(0) // combat never starts without its textures

  await page.getByRole('button', { name: 'Retry' }).click()
  await waitForMatch(page)
  await expect(page.getByRole('meter', { name: 'Health' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(requests).toBe(2)
})
