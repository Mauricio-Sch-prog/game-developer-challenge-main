import { useRef, useState, type FormEvent } from 'react'
import { loadSoundEnabled, playSound, setSoundEnabled } from '../audio/sounds'
import {
  loadOptions,
  OPTION_LIMITS,
  saveOptions,
  validateOptions,
  type PlayerOptions,
} from '../settings/options'

type OptionKey = keyof PlayerOptions

const FIELDS: readonly { key: OptionKey; label: string }[] = [
  { key: 'sessionSeconds', label: 'Game session time' },
  { key: 'spawnIntervalSeconds', label: 'Enemy spawn time' },
]

const CONTROLS = '/png/default/ui/controls'

interface OptionsScreenProps {
  onBack: () => void
}

/** Inputs keep raw strings so the player can type freely; validation runs on the parsed numbers. */
export function OptionsScreen({ onBack }: OptionsScreenProps) {
  const [values, setValues] = useState<Record<OptionKey, string>>(() => {
    const saved = loadOptions()
    return { sessionSeconds: String(saved.sessionSeconds), spawnIntervalSeconds: String(saved.spawnIntervalSeconds) }
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle')
  const [soundOn, setSoundOn] = useState(loadSoundEnabled)
  const inputRefs = useRef<Partial<Record<OptionKey, HTMLInputElement | null>>>({})

  const parsed: PlayerOptions = {
    sessionSeconds: values.sessionSeconds.trim() === '' ? NaN : Number(values.sessionSeconds),
    spawnIntervalSeconds: values.spawnIntervalSeconds.trim() === '' ? NaN : Number(values.spawnIntervalSeconds),
  }
  const errors = validateOptions(parsed)

  const setValue = (key: OptionKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setSaveStatus('idle')
  }

  const step = (key: OptionKey, direction: -1 | 1) => {
    const { min, max, step: size } = OPTION_LIMITS[key]
    const current = Number.isFinite(parsed[key]) ? parsed[key] : min
    const next = Math.min(max, Math.max(min, Math.round((current + direction * size) * 100) / 100))
    setValue(key, String(next))
  }

  /** Sound applies (and is saved) immediately, so the player hears the change. */
  const toggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled)
    setSoundOn(enabled)
    if (enabled) playSound('ui_click', { volume: 0.5 })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const firstInvalid = FIELDS.find(({ key }) => errors[key])
    if (firstInvalid) {
      inputRefs.current[firstInvalid.key]?.focus()
      return
    }
    setSaveStatus(saveOptions(parsed) ? 'saved' : 'failed')
  }

  return (
    <main className="screen">
      <form className="panel" onSubmit={submit} noValidate>
        <h1>Options</h1>

        {FIELDS.map(({ key, label }) => {
          const { min, max, step: size } = OPTION_LIMITS[key]
          const error = errors[key]
          const hintId = `${key}-hint`
          const errorId = `${key}-error`
          return (
            <div className="option-field" key={key}>
              <label htmlFor={key}>{label}</label>
              <div className="stepper">
                <button
                  type="button"
                  className="round-button"
                  aria-label={`Decrease ${label}`}
                  onClick={() => step(key, -1)}
                >
                  <img src={`${CONTROLS}/icon_minus.png`} alt="" />
                </button>
                <input
                  ref={(element) => {
                    inputRefs.current[key] = element
                  }}
                  id={key}
                  type="number"
                  inputMode="decimal"
                  min={min}
                  max={max}
                  step={size}
                  value={values[key]}
                  onChange={(event) => setValue(key, event.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                />
                <span aria-hidden="true">s</span>
                <button
                  type="button"
                  className="round-button"
                  aria-label={`Increase ${label}`}
                  onClick={() => step(key, 1)}
                >
                  <img src={`${CONTROLS}/icon_plus.png`} alt="" />
                </button>
              </div>
              <p id={hintId} className="hint">
                {min}–{max} seconds
              </p>
              {error && (
                <p id={errorId} className="field-error">
                  {error}
                </p>
              )}
            </div>
          )
        })}

        <label className="toggle">
          <input type="checkbox" checked={soundOn} onChange={(event) => toggleSound(event.target.checked)} />
          Sound effects and music
        </label>

        <p className="save-status" role="status">
          {saveStatus === 'saved' && 'Options saved. They apply to your next match.'}
          {saveStatus === 'failed' && 'Could not save on this device (storage unavailable).'}
        </p>

        <button type="submit" className="btn btn-primary">
          Save
        </button>
        <button type="button" className="btn btn-secondary" onClick={onBack} data-sound="close">
          Main Menu
        </button>
      </form>
    </main>
  )
}
