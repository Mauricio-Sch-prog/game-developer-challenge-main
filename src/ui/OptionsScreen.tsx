import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { pendingMatches } from '../api/pendingMatches'
import { recordKeys } from '../api/queries'
import { loadSoundEnabled, playSound, setSoundEnabled } from '../audio/sounds'
import { resetDb } from '../mocks/db'
import { getScenario, isScenarioId, resetScenario, SCENARIOS, setScenario, type ScenarioId } from '../mocks/scenarios'
import {
  loadOptions,
  OPTION_LIMITS,
  saveOptions,
  validateOptions,
  type PlayerOptions,
} from '../settings/options'
import { loadPlayer, PLAYER_NAME_LIMITS, savePlayerName, validatePlayerName } from '../settings/player'

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
  const [name, setName] = useState(() => loadPlayer().name)
  const nameRef = useRef<HTMLInputElement>(null)
  const inputRefs = useRef<Partial<Record<OptionKey, HTMLInputElement | null>>>({})

  const parsed: PlayerOptions = {
    sessionSeconds: values.sessionSeconds.trim() === '' ? NaN : Number(values.sessionSeconds),
    spawnIntervalSeconds: values.spawnIntervalSeconds.trim() === '' ? NaN : Number(values.spawnIntervalSeconds),
  }
  const errors = validateOptions(parsed)
  const nameError = validatePlayerName(name)

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
    if (nameError) {
      nameRef.current?.focus()
      return
    }
    const firstInvalid = FIELDS.find(({ key }) => errors[key])
    if (firstInvalid) {
      inputRefs.current[firstInvalid.key]?.focus()
      return
    }
    const saved = saveOptions(parsed) && savePlayerName(name)
    setSaveStatus(saved ? 'saved' : 'failed')
  }

  return (
    <main className="screen">
      <form className="panel options-panel" onSubmit={submit} noValidate>
        <h1>Options</h1>

        {/* Scrolls on short screens; the title and the actions below stay in view. */}
        <div className="options-body panel-scroll">
          <div className="options-column">
            <div className="option-field">
              <label htmlFor="player-name">Captain name</label>
              <input
                ref={nameRef}
                id="player-name"
                className="text-input"
                type="text"
                autoComplete="nickname"
                maxLength={PLAYER_NAME_LIMITS.max + 10}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setSaveStatus('idle')
                }}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? 'player-name-hint player-name-error' : 'player-name-hint'}
              />
              <p id="player-name-hint" className="hint">
                Shown in the ranking ({PLAYER_NAME_LIMITS.min}–{PLAYER_NAME_LIMITS.max} characters)
              </p>
              {nameError && (
                <p id="player-name-error" className="field-error">
                  {nameError}
                </p>
              )}
            </div>

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
          </div>

          <div className="options-column">
            <label className="toggle">
              <input type="checkbox" checked={soundOn} onChange={(event) => toggleSound(event.target.checked)} />
              Sound effects and music
            </label>

            <MockApiPanel />
          </div>
        </div>

        <p className="save-status" role="status">
          {saveStatus === 'saved' && 'Options saved. They apply to your next match.'}
          {saveStatus === 'failed' && 'Could not save on this device (storage unavailable).'}
        </p>

        <div className="btn-row">
          <button type="submit" className="btn btn-primary">
            Save
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack} data-sound="close">
            Main Menu
          </button>
        </div>
      </form>
    </main>
  )
}

/**
 * Picks the network scenario simulated by the mock API (MSW) and restores its
 * initial data. Part of the demo: lets reviewers reproduce every failure case.
 */
function MockApiPanel() {
  const queryClient = useQueryClient()
  const [scenario, setScenarioState] = useState<ScenarioId>(getScenario)
  const [message, setMessage] = useState('')

  const change = (id: ScenarioId) => {
    setScenario(id)
    setScenarioState(id)
    setMessage('')
    // A recovered network should send what is still pending and refresh the lists.
    pendingMatches.retryFailed()
    void queryClient.invalidateQueries({ queryKey: recordKeys.all })
  }

  const reset = () => {
    resetDb()
    resetScenario()
    setScenarioState('success')
    queryClient.removeQueries({ queryKey: recordKeys.all })
    pendingMatches.retryFailed()
    setMessage('Mock data and network restored to their initial state.')
  }

  return (
    <fieldset className="mock-panel">
      <legend>Network simulation (mock API)</legend>
      <label htmlFor="mock-scenario">Scenario</label>
      <select
        id="mock-scenario"
        value={scenario}
        onChange={(event) => {
          if (isScenarioId(event.target.value)) change(event.target.value)
        }}
        aria-describedby="mock-scenario-hint"
      >
        {Object.entries(SCENARIOS).map(([id, { label }]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <p id="mock-scenario-hint" className="hint">
        {SCENARIOS[scenario].description}
      </p>
      <button type="button" className="link-button" onClick={reset}>
        Reset mock data
      </button>
      <p className="save-status" role="status">
        {message}
      </p>
    </fieldset>
  )
}
