import { useRef, type PointerEvent } from 'react'
import type { Action, Steering } from '../game/input/InputManager'

/** Retina art: the touch buttons are drawn bigger than the 64px default sprites. */
const CONTROLS = '/png/retina/ui/controls'

/** Below this deflection (fraction of the joystick radius) nothing happens. */
const DEAD_ZONE = 0.2
/** Full speed is reached before the very edge, so the thumb does not need to stretch. */
const FULL_THRUST_AT = 0.85

interface ControlButton {
  action: Action
  icon: string
  label: string
}

/** Right thumb: cannons. The middle button sits higher. */
const CANNONS: readonly ControlButton[] = [
  { action: 'fireLeft', icon: 'icon_fire_left', label: 'Fire left broadside' },
  { action: 'fireFront', icon: 'icon_fire_front', label: 'Fire front cannon' },
  { action: 'fireRight', icon: 'icon_fire_right', label: 'Fire right broadside' },
]

interface JoystickProps {
  onSteer: (steering: Steering | null) => void
}

/**
 * One-finger steering: drag towards where the ship should sail. The ship
 * turns to that direction (simulation side) and its speed follows how far the
 * knob is pushed; a small push only rotates it, which is handy for aiming.
 *
 * The knob is moved through its style directly, so dragging never causes
 * React renders.
 */
function Joystick({ onSteer }: JoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  /** The finger that owns the joystick; other fingers are ignored. */
  const pointerId = useRef<number | null>(null)

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const base = baseRef.current
    const knob = knobRef.current
    if (!base || !knob) return

    const rect = base.getBoundingClientRect()
    const radius = rect.width / 2
    const dx = event.clientX - (rect.left + radius)
    const dy = event.clientY - (rect.top + radius)
    const distance = Math.hypot(dx, dy)

    // The knob follows the finger but stays fully inside the base (never cut by the screen edge).
    const travel = radius - knob.offsetWidth / 2
    const limit = distance > travel ? travel / distance : 1
    knob.style.transform = `translate(${dx * limit}px, ${dy * limit}px)`

    // Measured on the knob's travel, so what you see matches the speed you get.
    const deflection = Math.min(distance / travel, 1)
    if (deflection < DEAD_ZONE) {
      onSteer(null)
      return
    }
    // Screen and arena share the same orientation, so the screen angle is the world heading.
    const thrust = Math.min(1, (deflection - DEAD_ZONE) / (FULL_THRUST_AT - DEAD_ZONE))
    onSteer({ heading: Math.atan2(dy, dx), thrust })
  }

  const press = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return
    event.preventDefault()
    pointerId.current = event.pointerId
    // Keeps receiving this finger's moves even outside the joystick.
    event.currentTarget.setPointerCapture(event.pointerId)
    update(event)
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === pointerId.current) update(event)
  }

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) return
    pointerId.current = null
    if (knobRef.current) knobRef.current.style.transform = ''
    onSteer(null)
  }

  return (
    <div
      ref={baseRef}
      className="joystick"
      // Pointer-only gesture surface; keyboard players steer with the arrow/WASD keys.
      aria-hidden="true"
      onPointerDown={press}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={knobRef} className="joystick-knob" />
    </div>
  )
}

interface TouchControlsProps {
  onAction: (action: Action, down: boolean) => void
  onSteer: (steering: Steering | null) => void
}

/**
 * On-screen controls for touch devices: joystick on the left, cannons on the
 * right. Each control tracks its own finger, so steering and firing work at
 * the same time.
 */
export function TouchControls({ onAction, onSteer }: TouchControlsProps) {
  const renderButton = ({ action, icon, label }: ControlButton) => {
    const press = (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      // Keeps receiving this finger's events even if it slides off the button.
      event.currentTarget.setPointerCapture(event.pointerId)
      onAction(action, true)
    }
    const release = () => onAction(action, false)

    return (
      <button
        key={action}
        type="button"
        className="round-button touch-button"
        aria-label={label}
        // Keyboard players already have keys; keep these out of the tab order.
        tabIndex={-1}
        // Firing already has its cannon sound.
        data-sound="none"
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <img src={`${CONTROLS}/${icon}.png`} alt="" draggable={false} />
      </button>
    )
  }

  return (
    <div className="touch-controls">
      <Joystick onSteer={onSteer} />
      <div className="touch-pad">{CANNONS.map(renderButton)}</div>
    </div>
  )
}
