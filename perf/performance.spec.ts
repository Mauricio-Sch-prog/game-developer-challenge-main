import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { openApp, startMatch } from '../e2e/support'

/**
 * Benchmark match: the Options extremes (longest session, fastest spawns), so
 * the arena stays at its enemy cap for the whole three minutes.
 */
const BENCH_OPTIONS = {
  // PERF_SESSION_SECONDS=60 gives a quicker (shorter) run while tuning.
  sessionSeconds: Number(process.env.PERF_SESSION_SECONDS ?? 180),
  spawnIntervalSeconds: 0.5,
}
/** The player's HP is restored below this value (see `playInPage`). */
const HEAL_BELOW = 60
const MEMORY_CYCLES = 5
const MEMORY_PLAY_SECONDS = 30
const RESULTS_DIR = path.join(import.meta.dirname, 'results')

interface Sample {
  /** Real seconds since the measurement started. */
  t: number
  /** Match seconds (pauses excluded). */
  elapsed: number
  enemies: number
  projectiles: number
  displayObjects: number
  /** Frames drawn during the last second. */
  fps: number
}

interface PlayResult {
  /** Milliseconds between consecutive animation frames. */
  intervals: number[]
  samples: Sample[]
  endReason: string | null
  elapsed: number
  score: number
  spawned: number
}

/**
 * Runs inside the page, on requestAnimationFrame next to the game loop, for
 * `maxSeconds` of real time or until the match ends:
 * - a keyboard bot: turns to the nearest enemy (A/D), fires the front cannon
 *   when aimed (Space) and a broadside when an enemy is abeam and close (Q/E);
 * - benchmark only: restores the player's HP below `healBelow`, otherwise the
 *   ship sinks within a minute at this spawn rate and the load would stop;
 * - records every frame interval and one entity sample per second.
 */
function playInPage({ maxSeconds, healBelow }: { maxSeconds: number; healBelow: number }): Promise<PlayResult> {
  const hooks = window.__PIRATE_BATTLE__
  if (!hooks) throw new Error('No match is running (open the app with ?test)')
  const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
  const held = new Set<string>()
  const key = (code: string, down: boolean) => {
    if (held.has(code) === down) return
    if (down) held.add(code)
    else held.delete(code)
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }))
  }

  const intervals: number[] = []
  const samples: Sample[] = []
  const start = performance.now()
  let last = start
  let nextSample = start + 1000
  let framesThisSecond = 0

  return new Promise((resolve) => {
    const frame = (now: number) => {
      intervals.push(now - last)
      last = now
      framesThisSecond += 1
      const world = hooks.getWorld()
      const done = world.status === 'over' || now - start >= maxSeconds * 1000

      if (now >= nextSample || done) {
        samples.push({
          t: (now - start) / 1000,
          elapsed: world.elapsed,
          enemies: world.enemies.length,
          projectiles: world.projectiles.length,
          displayObjects: hooks.countDisplayObjects(),
          fps: framesThisSecond,
        })
        framesThisSecond = 0
        nextSample += 1000
      }

      if (done) {
        for (const code of [...held]) key(code, false)
        resolve({
          intervals,
          samples,
          endReason: world.endReason,
          elapsed: world.elapsed,
          score: world.score,
          spawned: world.spawnCount,
        })
        return
      }

      const { player, enemies, config } = world
      if (player.hp < healBelow) player.hp = player.maxHp

      let error = 0
      let nearest = Infinity
      let left = false
      let right = false
      for (const enemy of enemies) {
        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y)
        const bearing = wrap(Math.atan2(enemy.y - player.y, enemy.x - player.x) - player.angle)
        if (distance < nearest) {
          nearest = distance
          error = bearing
        }
        if (distance < 380 && Math.abs(bearing + Math.PI / 2) < 0.35) left = true
        if (distance < 380 && Math.abs(bearing - Math.PI / 2) < 0.35) right = true
      }
      const step = config.player.turnSpeed / 60
      key('KeyA', error < -step)
      key('KeyD', error > step)
      key('Space', nearest < Infinity && Math.abs(error) < 0.1)
      key('KeyQ', left)
      key('KeyE', right)

      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits))

/** Frame-interval buckets: one 60 Hz frame (≤ 17 ms), a late frame, one or two missed frames, a hitch. */
const HISTOGRAM_BUCKETS = [
  ['<=17ms', 17],
  ['17-20ms', 20],
  ['20-33ms', 33.4],
  ['33-50ms', 50],
  ['>50ms', Infinity],
] as const

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]
}

function summarizeFrames(intervals: number[]) {
  // The first interval runs from the start of the measurement to the first frame.
  const frames = intervals.slice(1)
  const sorted = [...frames].sort((a, b) => a - b)
  const totalMs = frames.reduce((sum, value) => sum + value, 0)
  const histogram: Record<string, number> = {}
  let lower = -Infinity
  for (const [label, upper] of HISTOGRAM_BUCKETS) {
    histogram[label] = frames.filter((value) => value > lower && value <= upper).length
    lower = upper
  }
  return {
    frames: frames.length,
    seconds: round(totalMs / 1000, 1),
    averageFps: round(frames.length / (totalMs / 1000), 1),
    frameTimeMs: {
      mean: round(totalMs / frames.length),
      p50: round(percentile(sorted, 50)),
      p95: round(percentile(sorted, 95)),
      p99: round(percentile(sorted, 99)),
      max: round(sorted[sorted.length - 1]),
    },
    histogram,
  }
}

function summarizeEntities(samples: Sample[]) {
  const stats = (pick: (sample: Sample) => number) => {
    const values = samples.map(pick)
    return {
      average: round(values.reduce((sum, value) => sum + value, 0) / values.length, 1),
      peak: Math.max(...values),
    }
  }
  return {
    enemies: stats((sample) => sample.enemies),
    projectiles: stats((sample) => sample.projectiles),
    displayObjects: stats((sample) => sample.displayObjects),
    lowestFpsSecond: Math.min(...samples.slice(0, -1).map((sample) => sample.fps)),
  }
}

async function metrics(cdp: CDPSession): Promise<Record<string, number>> {
  const { metrics: list } = await cdp.send('Performance.getMetrics')
  return Object.fromEntries(list.map((metric) => [metric.name, metric.value]))
}

function readOsName(): string {
  try {
    const match = /PRETTY_NAME="([^"]+)"/.exec(readFileSync('/etc/os-release', 'utf8'))
    if (match) return match[1]
  } catch {
    // Not Linux: fall back to the kernel name.
  }
  return `${os.type()} ${os.release()}`
}

/** Linux laptops: "AC" when a mains adapter (AC, ACAD, ADP1...) is online. */
function readPowerSource(): string {
  try {
    const dir = '/sys/class/power_supply'
    const mains = readdirSync(dir).filter((name) => readFileSync(path.join(dir, name, 'type'), 'utf8').trim() === 'Mains')
    if (mains.length === 0) return 'unknown'
    const online = mains.some((name) => readFileSync(path.join(dir, name, 'online'), 'utf8').trim() === '1')
    return online ? 'AC' : 'battery'
  } catch {
    return 'unknown'
  }
}

async function environment(page: Page, browserVersion: string, project: string) {
  const webgl = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
  })
  const screen = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  }))
  return {
    project,
    cpu: `${os.cpus()[0]?.model ?? 'unknown'} (${os.cpus().length} threads)`,
    memoryGiB: round(os.totalmem() / 2 ** 30, 1),
    os: readOsName(),
    power: readPowerSource(),
    browser: `Chromium ${browserVersion} (headless)`,
    webgl,
    viewport: screen,
    date: new Date().toISOString(),
  }
}

function writeResult(name: string, data: unknown): void {
  mkdirSync(RESULTS_DIR, { recursive: true })
  writeFileSync(path.join(RESULTS_DIR, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`)
}

async function openBenchmark(page: Page): Promise<CDPSession> {
  await openApp(page)
  await page.evaluate((options) => localStorage.setItem('pirate-battle:options', JSON.stringify(options)), BENCH_OPTIONS)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  return cdp
}

test('combat: a 3-minute match at maximum load', async ({ page, browser }, testInfo) => {
  const cdp = await openBenchmark(page)
  await startMatch(page)

  const before = await metrics(cdp)
  const run = await page.evaluate(playInPage, { maxSeconds: BENCH_OPTIONS.sessionSeconds + 30, healBelow: HEAL_BELOW })
  const after = await metrics(cdp)

  const frames = summarizeFrames(run.intervals)
  const result = {
    environment: await environment(page, browser.version(), testInfo.project.name),
    match: {
      ...BENCH_OPTIONS,
      seed: 2,
      healBelow: HEAL_BELOW,
      completed: run.endReason === 'time',
      simulatedSeconds: round(run.elapsed, 1),
      // Below 1, frames take longer than the 0.25 s a frame may simulate: the game runs in slow motion.
      simulationSpeed: round(run.elapsed / frames.seconds),
      score: run.score,
      enemiesSpawned: run.spawned,
    },
    frames,
    // Main-thread time per frame (scripts, style/layout, rendering commands), from the Chrome DevTools protocol.
    mainThreadMsPerFrame: {
      task: round(((after.TaskDuration - before.TaskDuration) * 1000) / frames.frames),
      script: round(((after.ScriptDuration - before.ScriptDuration) * 1000) / frames.frames),
    },
    entities: summarizeEntities(run.samples),
    samples: run.samples.map((sample) => ({ ...sample, t: round(sample.t, 1), elapsed: round(sample.elapsed, 1) })),
  }
  writeResult(`${testInfo.project.name}-combat`, result)
  console.log(
    JSON.stringify(
      { project: testInfo.project.name, match: result.match, frames, mainThread: result.mainThreadMsPerFrame, entities: result.entities },
      null,
      2,
    ),
  )

  // The reference setup plays the whole match in real time. Other setups are only measured.
  if (testInfo.project.name === 'gpu') {
    expect(run.endReason).toBe('time')
    expect(run.elapsed).toBe(BENCH_OPTIONS.sessionSeconds)
  }
})

test('memory: five cycles of starting, playing and leaving a match', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'gpu', 'Memory is profiled on the reference (GPU) setup only')
  const warnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || /WebGL context/i.test(message.text())) warnings.push(message.text())
  })
  const cdp = await openBenchmark(page)

  const measure = async (label: string, peakDisplayObjects: number | null) => {
    // Twice, so objects freed by finalizers of the first pass are collected too.
    await cdp.send('HeapProfiler.collectGarbage')
    await cdp.send('HeapProfiler.collectGarbage')
    const m = await metrics(cdp)
    return {
      label,
      heapUsedMB: round(m.JSHeapUsedSize / 2 ** 20),
      domNodes: m.Nodes,
      eventListeners: m.JSEventListeners,
      canvases: await page.locator('canvas').count(),
      peakDisplayObjects,
    }
  }

  const rows = [await measure('menu, before any match', null)]
  for (let cycle = 1; cycle <= MEMORY_CYCLES; cycle++) {
    await startMatch(page)
    const run = await page.evaluate(playInPage, { maxSeconds: MEMORY_PLAY_SECONDS, healBelow: HEAL_BELOW })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
    expect(await page.evaluate(() => window.__PIRATE_BATTLE__ === undefined)).toBe(true)
    rows.push(await measure(`after cycle ${cycle}`, Math.max(...run.samples.map((sample) => sample.displayObjects))))
  }

  const first = rows[1]
  const last = rows[rows.length - 1]
  const result = {
    environment: await environment(page, browser.version(), testInfo.project.name),
    cycle: { ...BENCH_OPTIONS, playSeconds: MEMORY_PLAY_SECONDS, leaveVia: 'pause → Main Menu' },
    rows,
    growthFromCycle1To5: {
      heapUsedMB: round(last.heapUsedMB - first.heapUsedMB),
      domNodes: last.domNodes - first.domNodes,
      eventListeners: last.eventListeners - first.eventListeners,
    },
    consoleWarnings: warnings,
  }
  writeResult('gpu-memory', result)
  console.table(rows)
  console.log('growth from cycle 1 to 5:', result.growthFromCycle1To5)

  // Every match leaves nothing behind on screen.
  for (const row of rows) expect(row.canvases).toBe(0)
})
