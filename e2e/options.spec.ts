import { expect, test } from '@playwright/test'
import { openApp } from './support'

test('menu works from the keyboard; options are validated, saved and kept after a refresh', async ({ page }) => {
  await openApp(page)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Options' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible()

  const session = page.getByRole('spinbutton', { name: 'Game session time' })
  const spawn = page.getByRole('spinbutton', { name: 'Enemy spawn time' })
  const save = page.getByRole('button', { name: 'Save' })

  // Out of range: an accessible error, and saving moves focus to the field instead.
  await session.fill('30')
  await expect(page.getByText('Enter a whole number of seconds between 60 and 180.')).toBeVisible()
  await expect(session).toHaveAttribute('aria-invalid', 'true')
  await save.click()
  await expect(session).toBeFocused()
  await expect(page.getByText('Options saved')).toHaveCount(0)

  await session.fill('120')
  await spawn.fill('0')
  await expect(page.getByText('Enter a number of seconds between 0.5 and 10.')).toBeVisible()
  await spawn.fill('1.5')
  await save.click()
  await expect(page.getByText('Options saved. They apply to your next match.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(session).toHaveValue('120')
  await expect(spawn).toHaveValue('1.5')
})
