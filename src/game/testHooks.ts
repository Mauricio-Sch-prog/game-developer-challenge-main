import type { World } from './sim/types'

/**
 * Read-only window into the running match for automated tests.
 * Only enabled with `?test` in the URL; players never get it.
 */
export interface PirateBattleTestHooks {
  getWorld: () => Readonly<World>
}

declare global {
  interface Window {
    __PIRATE_BATTLE__?: PirateBattleTestHooks
  }
}

export function testHooksEnabled(): boolean {
  return new URLSearchParams(window.location.search).has('test')
}
