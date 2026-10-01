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

/** Touch joystick state: where to go (radians, screen = world orientation) and how fast (0..1). */
export interface Steering {
  heading: number
  thrust: number
}

/**
 * Translates keyboard (and later touch) input into a `PlayerIntent`.
 * Listeners are only attached while a match is mounted, so game keys are
 * never captured on the menus.
 */
export class InputManager {
  private readonly held = new Set<Action>()
  /**
   * Actions pressed since the last frame. A key pressed and released between
   * two frames is still seen once, so quick taps are never lost.
   */
  private readonly tapped = new Set<Action>()
  private steering: Steering | null = null
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
    this.clear()
    this.onPauseKey = null
  }

  /**
   * While disabled (paused or match over) game keys are ignored and not
   * captured, so menus/dialogs keep working. Held keys are dropped so nothing
   * "fires" on resume.
   */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return
    this.enabled = enabled
    this.clear()
  }

  /** Touch joystick. `null` when the finger is lifted. */
  setSteering(steering: Steering | null): void {
    this.steering = this.enabled ? steering : null
  }

  /** Entry point for virtual buttons; goes through the same state as the keyboard. */
  setAction(action: Action, down: boolean): void {
    if (down) this.press(action)
    else this.held.delete(action)
  }

  /** Called once per simulation step. */
  readIntent(): PlayerIntent {
    const active = (action: Action) => this.held.has(action) || this.tapped.has(action)
    const left = active('turnLeft')
    const right = active('turnRight')
    const intent: PlayerIntent = {
      thrust: Math.max(active('forward') ? 1 : 0, this.steering?.thrust ?? 0),
      turn: left === right ? 0 : left ? -1 : 1,
      heading: this.steering?.heading ?? null,
      fireFront: active('fireFront'),
      fireLeft: active('fireLeft'),
      fireRight: active('fireRight'),
    }
    this.tapped.clear()
    return intent
  }

  private press(action: Action): void {
    if (!this.enabled) return
    this.held.add(action)
    this.tapped.add(action)
  }

  private clear(): void {
    this.held.clear()
    this.tapped.clear()
    this.steering = null
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
    this.press(action)
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code]
    if (action) this.held.delete(action)
  }
}
