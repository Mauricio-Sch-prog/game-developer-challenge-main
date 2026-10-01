import { useCallback, useRef, useState } from 'react'
import type { MatchRecord } from './api/contracts'
import { pendingMatches } from './api/pendingMatches'
import { useMatchSync } from './api/useMatchSync'
import { useUiSounds } from './audio/useUiSounds'
import type { GameConfig } from './game/config'
import { loadLastResult, saveLastResult, type MatchResult } from './settings/lastResult'
import { buildMatchConfig, loadOptions, type PlayerOptions } from './settings/options'
import { loadPlayer } from './settings/player'
import { readSessionFlag, writeSessionFlag } from './storage'
import { GameScreen } from './ui/GameScreen'
import { MainMenu } from './ui/MainMenu'
import type { MatchSummary } from './ui/MatchOverlay'
import { OptionsScreen } from './ui/OptionsScreen'
import { RecordsScreen, type RecordsTab } from './ui/RecordsScreen'
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
  | { name: 'records'; tab: RecordsTab }

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
  // Sends finished matches to the API in the background, on every screen.
  useMatchSync()

  const goTo = useCallback((next: Screen) => {
    writeSessionFlag(SHOWING_RESULT_KEY, next.name === 'result')
    setScreen(next)
  }, [])

  const play = useCallback(() => goTo({ name: 'play', match: newMatch() }), [goTo])
  const mainMenu = useCallback(() => goTo({ name: 'menu' }), [goTo])

  /** The finished match: recorded the moment it ends, shown once its banner is over. */
  const finished = useRef<MatchResult | null>(null)
  const match = screen.name === 'play' ? screen.match : null

  const finish = useCallback(
    (summary: MatchSummary) => {
      // One record per match, however many times this is called.
      if (!match || finished.current?.matchId === match.id) return
      const finishedAt = new Date().toISOString()
      const player = loadPlayer()
      const record: MatchRecord = {
        matchId: match.id,
        playerId: player.id,
        playerName: player.name,
        finishedAt,
        score: summary.score,
        durationSeconds: summary.timePlayed,
        endReason: summary.endReason,
        config: { sessionSeconds: match.options.sessionSeconds, spawnIntervalSeconds: match.options.spawnIntervalSeconds },
      }
      // Queued (and persisted) first, sent in the background: it survives failures and refreshes.
      pendingMatches.add(record)
      const result: MatchResult = { ...summary, matchId: match.id, finishedAt, options: match.options }
      finished.current = result
      saveLastResult(result)
      // The match can no longer be abandoned: a refresh from now on shows its result.
      writeSessionFlag(SHOWING_RESULT_KEY, true)
    },
    [match],
  )

  const showResult = useCallback(() => {
    const result = finished.current
    if (result && result.matchId === match?.id) goTo({ name: 'result', result })
  }, [match, goTo])

  switch (screen.name) {
    case 'menu':
      return (
        <MainMenu
          onPlay={play}
          onOptions={() => goTo({ name: 'options' })}
          onRecords={(tab) => goTo({ name: 'records', tab })}
        />
      )
    case 'options':
      return <OptionsScreen onBack={mainMenu} />
    case 'play':
      return (
        <GameScreen
          key={screen.match.id}
          config={screen.match.config}
          seed={screen.match.seed}
          onFinish={finish}
          onShowResult={showResult}
          onExit={mainMenu}
        />
      )
    case 'result':
      return <ResultScreen result={screen.result} onPlayAgain={play} onMainMenu={mainMenu} />
    case 'records':
      return <RecordsScreen initialTab={screen.tab} onBack={mainMenu} />
  }
}
