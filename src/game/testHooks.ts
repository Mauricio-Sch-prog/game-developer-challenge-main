import type { World } from './sim/types'

/**
 * Window into the running match for automated tests.
 * Only enabled with `?test` in the URL; players never get it.
 */
export interface PirateBattleTestHooks {
  getWorld: () => Readonly<World>
  /**
   * Test clock (only with `?clock=manual`, otherwise it does nothing): plays
   * `seconds` of match time through the same frame code as the real loop, at
   * 60 frames per second, then draws once. `beforeFrame` lets a test react
   * every frame, e.g. by pressing keys. Does nothing while paused.
   */
  advance: (seconds: number, beforeFrame?: (world: Readonly<World>) => void) => void
}

declare global {
  interface Window {
    __PIRATE_BATTLE__?: PirateBattleTestHooks
  }
}

export function testHooksEnabled(): boolean {
  return new URLSearchParams(window.location.search).has('test')
}

/** `?test&clock=manual`: no real-time loop, the match only moves through `advance`. */
export function manualClockRequested(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.has('test') && params.get('clock') === 'manual'
}
