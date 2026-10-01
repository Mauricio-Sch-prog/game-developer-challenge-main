import type { IMediaInstance, SoundLibrary } from '@pixi/sound'
import { readJson, writeJson } from '../storage'

/**
 * Every file in assets/sounds, used as its own alias (`sound.play('ui_click')`).
 * Short effects first, the two big loops last, so effects are ready sooner.
 */
const SOUND_NAMES = [
  'ui_click',
  'ui_hover',
  'ui_back',
  'ui_open',
  'ui_close',
  'game_start',
  'game_pause',
  'game_resume',
  'game_complete',
  'game_over',
  'cannon_fire_1',
  'cannon_fire_2',
  'cannon_fire_3',
  'cannon_broadside',
  'cannonball_water_hit_1',
  'cannonball_water_hit_2',
  'ship_wood_hit_1',
  'ship_wood_hit_2',
  'ship_collision',
  'ship_explosion_1',
  'ship_explosion_2',
  'ship_sinking',
  'score_point',
  'time_warning',
  'health_low',
  'ocean_ambience_loop',
  'ship_sailing_loop',
] as const

export type SoundName = (typeof SOUND_NAMES)[number]

const BASE = `${import.meta.env.BASE_URL}sounds`
const ENABLED_KEY = 'pirate-battle:sound-enabled'
/** The same sound is not restarted within this window (e.g. 3 broadside balls → 1 sound). */
const MIN_REPEAT_MS = 60

const lastPlayed = new Map<SoundName, number>()
/** null until the first user gesture loads @pixi/sound. */
let library: SoundLibrary | null = null
let enabled = loadSoundEnabled()

/**
 * Starts loading every sound in the background. Never blocks the game and
 * never throws: a sound that fails to load simply stays silent.
 */
function preloadSounds(sound: SoundLibrary): void {
  for (const name of SOUND_NAMES) {
    sound.add(name, {
      url: `${BASE}/${name}.wav`,
      preload: true,
      loaded: (error) => {
        if (error) console.warn(`Sound "${name}" could not be loaded; continuing without it.`, error)
      },
    })
  }
}

/**
 * Some browsers (iOS) still need a later gesture to resume audio. @pixi/sound
 * listens to mouse/touch; this adds the keyboard for keyboard-only players.
 */
function resumeOnKeyboard(sound: SoundLibrary): void {
  const resume = () => {
    const context = sound.context.audioContext
    if (context.state === 'suspended') void context.resume()
    else document.removeEventListener('keydown', resume, true)
  }
  document.addEventListener('keydown', resume, true)
}

/**
 * Called once at startup. Browsers block audio until the user interacts, so
 * @pixi/sound (which creates the AudioContext on import) is only loaded on the
 * first click, tap or key press: no autoplay warnings, and a smaller main bundle.
 */
export function initAudio(): void {
  const start = () => {
    window.removeEventListener('pointerdown', start, true)
    window.removeEventListener('keydown', start, true)
    import('@pixi/sound')
      .then(({ sound }) => {
        library = sound
        if (!enabled) sound.muteAll()
        preloadSounds(sound)
        resumeOnKeyboard(sound)
      })
      .catch((error: unknown) => console.warn('Audio is unavailable; continuing without sound.', error))
  }
  window.addEventListener('pointerdown', start, true)
  window.addEventListener('keydown', start, true)
}

interface PlayOptions {
  volume?: number
  loop?: boolean
}

/**
 * Plays a sound if it is already loaded (a late sound is worse than none).
 * Returns the instance so loops can be paused, re-volumed and stopped.
 */
export function playSound(name: SoundName, { volume = 1, loop = false }: PlayOptions = {}): IMediaInstance | null {
  if (!library?.exists(name)) return null
  const media = library.find(name)
  if (!media.isLoaded) return null

  const now = performance.now()
  if (!loop && now - (lastPlayed.get(name) ?? -Infinity) < MIN_REPEAT_MS) return null
  lastPlayed.set(name, now)

  const instance = media.play({ volume, loop })
  return instance instanceof Promise ? null : instance
}

/** Picks one of several variations, so repeated sounds feel less mechanical. */
export function playRandom(names: readonly SoundName[], options?: PlayOptions): IMediaInstance | null {
  return playSound(names[Math.floor(Math.random() * names.length)], options)
}

export function loadSoundEnabled(): boolean {
  return readJson(ENABLED_KEY) !== false
}

/** Mutes/unmutes everything (music and effects) and remembers the choice. */
export function setSoundEnabled(value: boolean): void {
  enabled = value
  if (value) library?.unmuteAll()
  else library?.muteAll()
  writeJson(ENABLED_KEY, value)
}
