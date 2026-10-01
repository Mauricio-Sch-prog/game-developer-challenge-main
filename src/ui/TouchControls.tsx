import type { PointerEvent } from 'react'
import type { Action } from '../game/input/InputManager'

const CONTROLS = '/png/default/ui/controls'

interface ControlButton {
  action: Action
  icon: string
  label: string
}

/** Left thumb: steering. Right thumb: cannons. The middle button sits higher. */
const STEERING: readonly ControlButton[] = [
  { action: 'turnLeft', icon: 'icon_turn_left', label: 'Turn left' },
  { action: 'forward', icon: 'icon_forward', label: 'Sail forward' },
  { action: 'turnRight', icon: 'icon_turn_right', label: 'Turn right' },
]
const CANNONS: readonly ControlButton[] = [
  { action: 'fireLeft', icon: 'icon_fire_left', label: 'Fire left broadside' },
  { action: 'fireFront', icon: 'icon_fire_front', label: 'Fire front cannon' },
  { action: 'fireRight', icon: 'icon_fire_right', label: 'Fire right broadside' },
]

interface TouchControlsProps {
  onAction: (action: Action, down: boolean) => void
}

/**
 * On-screen buttons for touch devices. Each button tracks its own pointer,
 * so steering and firing work at the same time (multi-touch).
 */
export function TouchControls({ onAction }: TouchControlsProps) {
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
      <div className="touch-pad">{STEERING.map(renderButton)}</div>
      <div className="touch-pad">{CANNONS.map(renderButton)}</div>
    </div>
  )
}
