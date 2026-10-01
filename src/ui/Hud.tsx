import { useSyncExternalStore, type MouseEvent } from 'react'
import type { GameStore } from '../game/store/GameStore'
import { formatTime } from './format'

const HUD = '/png/default/ui/hud'
const CONTROLS = '/png/default/ui/controls'

/** From ui_sheet.json (`health_*` → ui.layout.fill_rect) on the 256px wide bar. */
const FILL_X = 30
const FILL_WIDTH = 196
const BAR_WIDTH = 256

interface HudProps {
  store: GameStore
  onPause: () => void
}

/**
 * React HUD. Subscribed to the GameStore, so it only re-renders when HP,
 * score, time or status change (about once per second), never per frame.
 */
export function Hud({ store, onPause }: HudProps) {
  const { hp, maxHp, score, timeLeft, status } = useSyncExternalStore(store.subscribe, store.getSnapshot)

  const ratio = Math.max(0, hp / maxHp)
  const fill = ratio > 0.5 ? 'green' : ratio > 0.25 ? 'amber' : 'red'
  // Clip the fill from the right, like the atlas metadata describes.
  const visible = ratio >= 1 ? BAR_WIDTH : FILL_X + FILL_WIDTH * ratio
  const clipRight = ((BAR_WIDTH - visible) / BAR_WIDTH) * 100

  const handlePause = (event: MouseEvent<HTMLButtonElement>) => {
    // Drop focus so Space fires the cannon instead of pressing this button again.
    event.currentTarget.blur()
    onPause()
  }

  return (
    <section className="hud" aria-label="Match status">
      <div className="hud-health">
        <img className="hud-icon" src={`${HUD}/icon_heart.png`} alt="" />
        <div
          className="hud-bar"
          role="meter"
          aria-label="Health"
          aria-valuemin={0}
          aria-valuemax={maxHp}
          aria-valuenow={hp}
        >
          <img src={`${HUD}/health_frame.png`} alt="" />
          {ratio > 0 && (
            <img src={`${HUD}/health_fill_${fill}.png`} alt="" style={{ clipPath: `inset(0 ${clipRight}% 0 0)` }} />
          )}
          <span>
            {hp} / {maxHp}
          </span>
        </div>
      </div>

      <div className="hud-right">
        <div className="hud-counter">
          <img src={`${HUD}/icon_score.png`} alt="" />
          <span aria-label={`Score ${score}`}>{score}</span>
        </div>
        <div className="hud-counter">
          <img src={`${HUD}/icon_time.png`} alt="" />
          <span aria-label={`Time left ${timeLeft} seconds`}>
            <time>{formatTime(timeLeft)}</time>
          </span>
        </div>
        <button
          type="button"
          className="round-button"
          onClick={handlePause}
          disabled={status !== 'running'}
          aria-label="Pause"
          data-sound="none"
        >
          <img src={`${CONTROLS}/icon_pause.png`} alt="" />
        </button>
      </div>

      {/* Announces state changes only (not the ticking timer) to screen readers. */}
      <p className="sr-only" aria-live="polite">
        {status === 'paused' ? 'Game paused' : status === 'over' ? 'Match over' : ''}
      </p>
    </section>
  )
}
