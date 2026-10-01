import { useCallback, useState } from 'react'
import { useUiSounds } from './audio/useUiSounds'
import type { GameConfig } from './game/config'
import { loadLastResult, saveLastResult, type MatchResult } from './settings/lastResult'
import { buildMatchConfig, loadOptions, type PlayerOptions } from './settings/options'
import { readSessionFlag, writeSessionFlag } from './storage'
import { GameScreen } from './ui/GameScreen'
import { MainMenu } from './ui/MainMenu'
import type { MatchSummary } from './ui/MatchOverlay'
import { OptionsScreen } from './ui/OptionsScreen'
import { ResultScreen } from './ui/ResultScreen'

interface Match {
  /** New id = new GameScreen instance = brand new engine (clean restart). */
  id: string
  options: PlayerOptions
  /** Snapshot taken at start; later option changes only affect new matches. */
  config: GameConfig
  seed: number
}

type Screen =
  | { name: 'menu' }
  | { name: 'options' }
  | { name: 'play'; match: Match }
  | { name: 'result'; result: MatchResult }

const SHOWING_RESULT_KEY = 'pirate-battle:showing-result'

/** `?seed=123` in the URL replays the same match (used by tests); random otherwise. */
function matchSeed(): number {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('seed'))
  return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : Math.floor(Math.random() * 2 ** 32)
}

/**
 * A refresh on the result screen shows the last result again.
 * A refresh during a match lands on the menu: the match is abandoned.
 */
function initialScreen(): Screen {
  const result = readSessionFlag(SHOWING_RESULT_KEY) ? loadLastResult() : null
  return result ? { name: 'result', result } : { name: 'menu' }
}

function newMatch(): Match {
  const options = loadOptions()
  return { id: crypto.randomUUID(), options, config: buildMatchConfig(options), seed: matchSeed() }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  useUiSounds()

  const goTo = useCallback((next: Screen) => {
    writeSessionFlag(SHOWING_RESULT_KEY, next.name === 'result')
    setScreen(next)
  }, [])

  const play = useCallback(() => goTo({ name: 'play', match: newMatch() }), [goTo])
  const mainMenu = useCallback(() => goTo({ name: 'menu' }), [goTo])

  const match = screen.name === 'play' ? screen.match : null
  const finish = useCallback(
    (summary: MatchSummary) => {
      if (!match) return
      const result: MatchResult = { ...summary, finishedAt: new Date().toISOString(), options: match.options }
      saveLastResult(result)
      goTo({ name: 'result', result })
    },
    [match, goTo],
  )

  switch (screen.name) {
    case 'menu':
      return <MainMenu onPlay={play} onOptions={() => goTo({ name: 'options' })} />
    case 'options':
      return <OptionsScreen onBack={mainMenu} />
    case 'play':
      return (
        <GameScreen
          key={screen.match.id}
          config={screen.match.config}
          seed={screen.match.seed}
          onFinish={finish}
          onExit={mainMenu}
        />
      )
    case 'result':
      return <ResultScreen result={screen.result} onPlayAgain={play} onMainMenu={mainMenu} />
  }
}
