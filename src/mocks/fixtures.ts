import type { MatchConfig, MatchRecord } from '../api/contracts'
import { createRandom } from '../game/sim/random'

/** Other captains in the ranking. Generated from a fixed seed: same data on every machine. */
const CAPTAINS = [
  'Captain Flint',
  'Red Sparrow',
  'Storm Rider',
  'Sea Wolf',
  'Anne Bonny',
  'Black Beard',
  'Calico Jack',
  'Grace O’Malley',
  'Long John',
  'Mary Read',
]

/** How many fixture matches exist per config (the default config spans several pages). */
const FIXTURE_CONFIGS: readonly { config: MatchConfig; matches: number }[] = [
  { config: { sessionSeconds: 60, spawnIntervalSeconds: 3 }, matches: 18 },
  { config: { sessionSeconds: 120, spawnIntervalSeconds: 3 }, matches: 9 },
  { config: { sessionSeconds: 90, spawnIntervalSeconds: 2 }, matches: 6 },
]

/** Fixed base date, so fixtures never depend on "now". */
const BASE_DATE = Date.UTC(2026, 8, 1, 18, 0, 0)

export function createFixtureMatches(): MatchRecord[] {
  const random = createRandom(2026)
  const records: MatchRecord[] = []
  let index = 0

  for (const { config, matches } of FIXTURE_CONFIGS) {
    for (let i = 0; i < matches; i++) {
      const captain = CAPTAINS[Math.floor(random() * CAPTAINS.length)]
      const died = random() < 0.35
      const duration = died ? 20 + Math.floor(random() * (config.sessionSeconds - 25)) : config.sessionSeconds
      const scorePerSecond = 0.15 + random() * 0.25
      records.push({
        matchId: `fixture-${String(index).padStart(3, '0')}`,
        playerId: `fixture-${captain.toLowerCase().replace(/[^a-z]+/g, '-')}`,
        playerName: captain,
        finishedAt: new Date(BASE_DATE + index * 47 * 60_000).toISOString(),
        score: Math.round(duration * scorePerSecond),
        durationSeconds: duration,
        endReason: died ? 'death' : 'time',
        config,
      })
      index++
    }
  }
  return records
}
