import type { IMediaInstance } from '@pixi/sound'
import { playRandom, playSound } from '../../audio/sounds'
import type { EndReason, GameEvent, World } from '../sim/types'

const OCEAN_VOLUME = 0.35
/** The sailing loop fades in with the player's speed, up to this volume. */
const SAILING_MAX_VOLUME = 0.45
/** Countdown ticks during the last seconds of the match. */
const TIME_WARNING_SECONDS = 5
const LOW_HEALTH_RATIO = 0.3

/**
 * Match audio. Like the EffectsLayer, it only reacts to simulation events
 * and state; the rules never know sound exists. Loops are owned here and
 * stopped on destroy.
 */
export class GameAudio {
  private ocean: IMediaInstance | null = null
  private sailing: IMediaInstance | null = null
  private lastWarnedSecond = Infinity
  private lowHealthWarned = false
  private stopped = false

  start(): void {
    playSound('game_start', { volume: 0.7 })
  }

  handle(event: GameEvent): void {
    switch (event.type) {
      case 'shot':
        if (event.weapon === 'broadside') {
          // One sound per volley: the throttle drops the other two balls.
          playSound('cannon_broadside', { volume: 0.6 })
        } else {
          const volume = event.team === 'player' ? 0.55 : 0.3
          playRandom(['cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3'], { volume })
        }
        break
      case 'hit':
        playRandom(['ship_wood_hit_1', 'ship_wood_hit_2'], { volume: 0.6 })
        break
      case 'splash':
      case 'impact':
        playRandom(['cannonball_water_hit_1', 'cannonball_water_hit_2'], { volume: 0.25 })
        break
      case 'ram':
        playSound('ship_collision', { volume: 0.7 })
        break
      case 'destroyed':
        playRandom(['ship_explosion_1', 'ship_explosion_2'], { volume: 0.7 })
        if (event.kind === 'player') playSound('ship_sinking', { volume: 0.6 })
        if (event.scored) playSound('score_point', { volume: 0.5 })
        break
    }
  }

  /** Per-frame state that is not an event: loops, countdown, low health. */
  update(world: World): void {
    if (this.stopped) return
    this.ensureLoops()

    const { player } = world
    if (this.sailing) this.sailing.volume = SAILING_MAX_VOLUME * (player.speed / world.config.player.maxSpeed)

    const secondsLeft = Math.ceil(world.timeLeft)
    if (secondsLeft <= TIME_WARNING_SECONDS && secondsLeft > 0 && secondsLeft < this.lastWarnedSecond) {
      this.lastWarnedSecond = secondsLeft
      playSound('time_warning', { volume: 0.6 })
    }

    if (!this.lowHealthWarned && player.alive && player.hp / player.maxHp < LOW_HEALTH_RATIO) {
      this.lowHealthWarned = true
      playSound('health_low', { volume: 0.7 })
    }
  }

  /**
   * The loops are stopped, not paused: @pixi/sound only releases (and recycles)
   * an instance that is playing, so a paused loop left with the match would
   * stay in memory forever. `update` starts them again after the resume.
   */
  pause(): void {
    this.releaseLoops()
    playSound('game_pause', { volume: 0.6 })
  }

  resume(): void {
    playSound('game_resume', { volume: 0.6 })
  }

  end(reason: EndReason): void {
    this.stopLoops()
    playSound(reason === 'death' ? 'game_over' : 'game_complete', { volume: 0.7 })
  }

  /** Silent cleanup when the match is left or restarted. */
  destroy(): void {
    this.stopLoops()
  }

  /** Loops may finish loading after the match started: start them as soon as they are ready. */
  private ensureLoops(): void {
    this.ocean ??= playSound('ocean_ambience_loop', { volume: OCEAN_VOLUME, loop: true })
    this.sailing ??= playSound('ship_sailing_loop', { volume: 0, loop: true })
  }

  private releaseLoops(): void {
    this.ocean?.stop()
    this.sailing?.stop()
    this.ocean = null
    this.sailing = null
  }

  private stopLoops(): void {
    this.stopped = true
    this.releaseLoops()
  }
}
