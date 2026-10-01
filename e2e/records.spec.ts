import { expect, test, type Page } from '@playwright/test'
import { compareForRanking, PAGE_SIZE, sameConfig, type MatchRecord } from '../src/api/contracts'
import { DEFAULT_CONFIG } from '../src/game/config'
import { createFixtureMatches } from '../src/mocks/fixtures'
import { openApp, playUntilOver, selectScenario, startMatch } from './support'

/** The ranking the mock server builds for the default options, from the same fixtures. */
const DEFAULT_MATCH_CONFIG = {
  sessionSeconds: DEFAULT_CONFIG.match.durationSeconds,
  spawnIntervalSeconds: DEFAULT_CONFIG.spawn.intervalSeconds,
}
const RANKING = createFixtureMatches()
  .filter((record) => sameConfig(record.config, DEFAULT_MATCH_CONFIG))
  .sort(compareForRanking)
const RANKING_PAGES = Math.ceil(RANKING.length / PAGE_SIZE)

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** One row per entry: rank, captain, points, then the date ("01 SEP · 18:00"). */
function rankingRows(entries: MatchRecord[], firstRank: number): RegExp[] {
  return entries.map((entry, index) => {
    const rank = String(firstRank + index).padStart(2, '0')
    return new RegExp(`^${rank}${escapeRegExp(entry.playerName)}${entry.score}\\d{2} [A-Z]{3}`)
  })
}

const rankingTable = (page: Page) => page.getByRole('table', { name: 'Ranking' }).locator('tbody tr')
const historyTable = (page: Page) => page.getByRole('table', { name: 'Match history' }).locator('tbody tr')
const ownRecords = (page: Page) =>
  page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('pirate-battle:mock-db') ?? '[]') as { matchId: string }[]
    return stored.filter((record) => !record.matchId.startsWith('fixture-')).length
  })

test('ranking lists the fixtures best first, page by page', { tag: '@mobile' }, async ({ page }) => {
  await openApp(page, { mockLatency: '300' })
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(page.getByText('Loading…')).toBeVisible()

  await expect(rankingTable(page)).toHaveText(rankingRows(RANKING.slice(0, PAGE_SIZE), 1))
  await expect(page.getByText(`Page 1 of ${RANKING_PAGES}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText(`Page 2 of ${RANKING_PAGES}`)).toBeVisible()
  await expect(rankingTable(page)).toHaveText(rankingRows(RANKING.slice(PAGE_SIZE, PAGE_SIZE * 2), PAGE_SIZE + 1))

  // Tabs work with the arrow keys; this player has no history yet.
  await page.getByRole('tab', { name: 'Ranking' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Match History' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('No battles recorded yet.')).toBeVisible()
})

test('shows error, recovery, empty and background-refresh states', async ({ page }) => {
  // Nothing cached yet: the failing ranking shows an error after its retries,
  // while the history tab keeps working.
  await openApp(page, { scenario: 'ranking-down' })
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load this list. Server error (503).')
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByText('No battles recorded yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Main Menu' }).click()

  // Network back: the list loads.
  await selectScenario(page, 'success')
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(rankingTable(page)).toHaveCount(PAGE_SIZE)
  await page.getByRole('button', { name: 'Main Menu' }).click()

  // An empty answer replaces the cached list.
  await selectScenario(page, 'empty')
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(page.getByText('No battles with these settings yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Main Menu' }).click()

  // A failed background refresh keeps the last good data on screen and says so.
  await selectScenario(page, 'server-error')
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(page.getByText('Could not refresh. Server error (500).')).toBeVisible()
  await expect(page.getByText('No battles with these settings yet.')).toBeVisible()
})

test('a finished match is registered once and shows in both tabs', async ({ page }) => {
  await openApp(page, { clock: 'manual' })
  await startMatch(page)
  await playUntilOver(page)
  await expect(page.getByText('Saved to the ranking and your match history.')).toBeVisible()
  await page.getByRole('button', { name: 'Main Menu' }).click()

  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(historyTable(page)).toHaveCount(1)
  await expect(historyTable(page).first()).toContainText('Defeated')

  // In the ranking it is the last entry (0 points), marked as the player's.
  await page.getByRole('tab', { name: 'Ranking' }).click()
  const pages = Math.ceil((RANKING.length + 1) / PAGE_SIZE)
  for (let current = 1; current < pages; current++) {
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText(`Page ${current + 1} of ${pages}`)).toBeVisible()
  }
  await expect(rankingTable(page).last()).toContainText('You')
  await expect(page.getByText('You', { exact: true })).toHaveCount(1)
  expect(await ownRecords(page)).toBe(1)
})

test('a registration that fails stays pending after a refresh and is sent on recovery', async ({ page }) => {
  await openApp(page, { clock: 'manual', scenario: 'offline' })
  await startMatch(page)
  await playUntilOver(page)
  await expect(page.getByRole('alert')).toContainText('Not saved yet: Could not reach the server.')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ship Sunk' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Not saved yet')

  // A pending registration never blocks a new match.
  await page.getByRole('button', { name: 'Play Again' }).click()
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Main Menu' }).click()

  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(page.getByText('1 battle is waiting to be saved')).toBeVisible()
  await page.getByRole('button', { name: 'Main Menu' }).click()

  // The network is back: the pending match is sent and both lists refresh.
  await selectScenario(page, 'success')
  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(historyTable(page)).toHaveCount(1)
  await expect(page.getByText(/waiting to be saved/)).toHaveCount(0)
  expect(await ownRecords(page)).toBe(1)
})

test('a timeout after registering is retried without duplicating the match', async ({ page }) => {
  await openApp(page, { clock: 'manual', scenario: 'register-timeout' })
  await startMatch(page)
  await playUntilOver(page)

  // The first answer is lost; after the 4 s client timeout the retry gets the stored record.
  await expect(page.getByText('Saving to the ranking…')).toBeVisible()
  await expect(page.getByText('Saved to the ranking and your match history.')).toBeVisible({ timeout: 10_000 })
  expect(await ownRecords(page)).toBe(1)

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(historyTable(page)).toHaveCount(1)
})

test('late answers never replace the page on screen', async ({ page }) => {
  // 100–3000 ms per request with a fixed seed: answers arrive out of order.
  await openApp(page, { scenario: 'variable-latency', mockLatency: undefined, mockSeed: '7' })
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(rankingTable(page)).toHaveCount(PAGE_SIZE)

  const next = page.getByRole('button', { name: 'Next page' })
  for (let i = 1; i < RANKING_PAGES; i++) await next.click()
  await expect(page.getByText(`Page ${RANKING_PAGES} of ${RANKING_PAGES}`)).toBeVisible()

  const lastPage = RANKING.slice((RANKING_PAGES - 1) * PAGE_SIZE)
  await expect(rankingTable(page)).toHaveText(rankingRows(lastPage, (RANKING_PAGES - 1) * PAGE_SIZE + 1), {
    timeout: 10_000,
  })
  // Once every request has settled, the last page is still the one shown.
  await expect(page.getByText('Updating…')).toHaveCount(0, { timeout: 10_000 })
  await expect(rankingTable(page)).toHaveText(rankingRows(lastPage, (RANKING_PAGES - 1) * PAGE_SIZE + 1))
})
