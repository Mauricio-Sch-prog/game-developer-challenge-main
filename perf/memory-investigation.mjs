/**
 * Memory investigation (see PERFORMANCE.md): repeated start → play → leave cycles,
 * the JS heap after forced garbage collection, and a heap snapshot diff between
 * two cycles, grouped by constructor, plus where suspended async functions come from.
 *
 * Needs a running build:   npm run build && npm run preview
 * Then:                    node perf/memory-investigation.mjs
 *
 * Environment variables:
 *   APP_URL=http://localhost:4173   app to profile (an unminified build shows real class names:
 *                                   npx vite build --minify false --outDir dist-debug
 *                                   npx vite preview --outDir dist-debug --port 4174)
 *   CYCLES=12  PLAY_MS=10000        number of cycles and real play time per cycle
 *   SNAP_FROM=2                     snapshot diff from this cycle to the last one
 *   CONTROL=1                       same Playwright commands, but Options instead of a match
 *   BLOCK_SW=1                      block service workers (no MSW mock API)
 */
import { chromium } from '@playwright/test'

const APP_URL = process.env.APP_URL ?? 'http://localhost:4173'
const CYCLES = Number(process.env.CYCLES ?? 12)
const PLAY_MS = Number(process.env.PLAY_MS ?? 10_000)
const SNAPSHOT_AT = [Number(process.env.SNAP_FROM ?? 2), CYCLES]
const CONTROL = process.env.CONTROL === '1'

const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=gl'] })
const page = await browser.newPage({
  viewport: { width: 1366, height: 768 },
  serviceWorkers: process.env.BLOCK_SW === '1' ? 'block' : 'allow',
})
await page.goto(`${APP_URL}/?test&seed=2&mockLatency=0`)
await page.getByRole('button', { name: 'Play', exact: true }).waitFor()
await page.evaluate(() =>
  localStorage.setItem('pirate-battle:options', JSON.stringify({ sessionSeconds: 180, spawnIntervalSeconds: 0.5 })),
)
const cdp = await page.context().newCDPSession(page)
await cdp.send('Performance.enable')

async function collectGarbage() {
  await cdp.send('HeapProfiler.collectGarbage')
  await cdp.send('HeapProfiler.collectGarbage')
}

async function readMetrics() {
  const { metrics } = await cdp.send('Performance.getMetrics')
  const m = Object.fromEntries(metrics.map((metric) => [metric.name, metric.value]))
  return { heapMB: Number((m.JSHeapUsedSize / 2 ** 20).toFixed(2)), domNodes: m.Nodes, listeners: m.JSEventListeners }
}

async function takeSnapshot() {
  const chunks = []
  const onChunk = ({ chunk }) => chunks.push(chunk)
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  return JSON.parse(chunks.join(''))
}

/** Count and self size per constructor name (other node types grouped as "(type)"). */
function groupByConstructor(snap) {
  const { node_fields: fields, node_types: [types] } = snap.snapshot.meta
  const width = fields.length
  const iType = fields.indexOf('type')
  const iName = fields.indexOf('name')
  const iSize = fields.indexOf('self_size')
  const groups = new Map()
  for (let i = 0; i < snap.nodes.length; i += width) {
    const type = types[snap.nodes[i + iType]]
    const name = type === 'object' || type === 'closure' ? snap.strings[snap.nodes[i + iName]] : `(${type})`
    const group = groups.get(name) ?? { count: 0, size: 0 }
    group.count += 1
    group.size += snap.nodes[i + iSize]
    groups.set(name, group)
  }
  return groups
}

/** Suspended async functions (Generator objects), grouped by "function @ script URL". */
function suspendedAsyncFunctions(snap) {
  const { node_fields: nf, edge_fields: ef, node_types: [nodeTypes], edge_types: [edgeTypes] } = snap.snapshot.meta
  const nw = nf.length
  const ew = ef.length
  const iEdges = nf.indexOf('edge_count')
  const iType = nf.indexOf('type')
  const iName = nf.indexOf('name')
  const nodeCount = snap.nodes.length / nw
  const firstEdge = new Uint32Array(nodeCount + 1)
  for (let n = 0; n < nodeCount; n++) firstEdge[n + 1] = firstEdge[n] + snap.nodes[n * nw + iEdges] * ew
  const nameOf = (node) => snap.strings[snap.nodes[node + iName]]
  const follow = (node, label) => {
    if (node < 0) return -1
    const n = node / nw
    for (let e = firstEdge[n]; e < firstEdge[n + 1]; e += ew) {
      const type = edgeTypes[snap.edges[e]]
      const edgeName = type === 'element' || type === 'hidden' ? snap.edges[e + 1] : snap.strings[snap.edges[e + 1]]
      if (edgeName === label) return snap.edges[e + 2]
    }
    return -1
  }
  const counts = new Map()
  for (let i = 0; i < snap.nodes.length; i += nw) {
    if (nodeTypes[snap.nodes[i + iType]] !== 'object' || nameOf(i) !== 'Generator') continue
    const fn = follow(i, 'function')
    const script = follow(follow(follow(fn, 'shared'), 'script'), 'name')
    const key = `${(fn >= 0 && nameOf(fn)) || '(anonymous)'} @ ${script >= 0 ? nameOf(script) || '(no url)' : '(unknown)'}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** The keyboard bot of perf/performance.spec.ts, with the same benchmark HP restore. */
function playInPage(duration) {
  const hooks = window.__PIRATE_BATTLE__
  const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
  const held = new Set()
  const key = (code, down) => {
    if (held.has(code) === down) return
    if (down) held.add(code)
    else held.delete(code)
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }))
  }
  const start = performance.now()
  return new Promise((resolve) => {
    const frame = (now) => {
      const world = hooks.getWorld()
      if (now - start > duration || world.status === 'over') {
        for (const code of [...held]) key(code, false)
        resolve()
        return
      }
      const { player, enemies, config } = world
      if (player.hp < 60) player.hp = player.maxHp
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

const rows = []
const snapshots = {}
for (let cycle = 1; cycle <= CYCLES; cycle++) {
  if (CONTROL) {
    await page.getByRole('button', { name: 'Options' }).click()
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Options')
    await page.evaluate((ms) => new Promise((resolve) => setTimeout(resolve, ms)), PLAY_MS)
    await page.keyboard.press('Tab')
  } else {
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.waitForFunction(() => window.__PIRATE_BATTLE__ !== undefined)
    await page.evaluate(playInPage, PLAY_MS)
    await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor()
  await collectGarbage()
  rows.push({ cycle, ...(await readMetrics()) })
  if (SNAPSHOT_AT.includes(cycle)) snapshots[cycle] = await takeSnapshot()
}
console.table(rows)

const [before, after] = SNAPSHOT_AT.map((cycle) => snapshots[cycle])
const groupsBefore = groupByConstructor(before)
const groupsAfter = groupByConstructor(after)
const diff = []
for (const [name, now] of groupsAfter) {
  const then = groupsBefore.get(name) ?? { count: 0, size: 0 }
  if (now.count !== then.count || now.size !== then.size) {
    diff.push({ name: name.slice(0, 60), count: now.count - then.count, kB: Number(((now.size - then.size) / 1024).toFixed(1)) })
  }
}
diff.sort((a, b) => b.kB - a.kB)
console.log(`Heap snapshot diff, cycle ${SNAPSHOT_AT[0]} → ${SNAPSHOT_AT[1]} (growth by constructor):`)
console.table(diff.slice(0, 20))
console.log('Total growth (kB):', diff.reduce((sum, row) => sum + row.kB, 0).toFixed(1))

const asyncBefore = suspendedAsyncFunctions(before)
const asyncAfter = suspendedAsyncFunctions(after)
console.log('Suspended async functions that grew, by origin:')
console.table(
  [...asyncAfter]
    .map(([origin, count]) => ({ origin, before: asyncBefore.get(origin) ?? 0, after: count }))
    .filter((row) => row.after !== row.before),
)
await browser.close()
