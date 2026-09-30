import type { PlayerIntent } from '../sim/types'

export type Action = 'forward' | 'turnLeft' | 'turnRight' | 'fireFront' | 'fireLeft' | 'fireRight'

/** Uses `KeyboardEvent.code` (physical key), so bindings work on any keyboard layout. */
export const KEY_BINDINGS: Readonly<Record<string, Action>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',
  Space: 'fireFront',
  KeyQ: 'fireLeft',
  KeyE: 'fireRight',
}

const PAUSE_KEYS: ReadonlySet<string> = new Set(['Escape', 'KeyP'])

/**
 * Translates keyboard (and later touch) input into a `PlayerIntent`.
 * Listeners are only attached while a match is mounted, so game keys are
 * never captured on the menus.
 */
export class InputManager {
  private readonly held = new Set<Action>()
  private target: Window | null = null
  private enabled = true

  /** Called on Esc/P. The engine decides whether that pauses or resumes. */
  onPauseKey: (() => void) | null = null

  attach(target: Window): void {
    if (this.target) return
    this.target = target
    target.addEventListener('keydown', this.handleKeyDown)
    target.addEventListener('keyup', this.handleKeyUp)
  }

  detach(): void {
    if (!this.target) return
    this.target.removeEventListener('keydown', this.handleKeyDown)
    this.target.removeEventListener('keyup', this.handleKeyUp)
    this.target = null
    this.held.clear()
    this.onPauseKey = null
  }

  /** While disabled (e.g. paused), held keys are dropped so nothing "fires" on resume. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.held.clear()
  }

  /** Entry point for virtual buttons; goes through the same state as the keyboard. */
  setAction(action: Action, down: boolean): void {
    if (!this.enabled) return
    if (down) this.held.add(action)
    else this.held.delete(action)
  }

  readIntent(): PlayerIntent {
    const left = this.held.has('turnLeft')
    const right = this.held.has('turnRight')
    return {
      thrust: this.held.has('forward'),
      turn: left === right ? 0 : left ? -1 : 1,
      fireFront: this.held.has('fireFront'),
      fireLeft: this.held.has('fireLeft'),
      fireRight: this.held.has('fireRight'),
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (PAUSE_KEYS.has(event.code)) {
      event.preventDefault()
      if (!event.repeat) this.onPauseKey?.()
      return
    }
    const action = KEY_BINDINGS[event.code]
    if (!action || !this.enabled) return
    // Stops arrows/space from scrolling the page while playing.
    event.preventDefault()
    this.held.add(action)
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code]
    if (action) this.held.delete(action)
  }
}
