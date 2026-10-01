import type { UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { describeApiError } from '../api/client'
import type { MatchConfig, MatchRecord, Page, RankingEntry } from '../api/contracts'
import { pendingMatches } from '../api/pendingMatches'
import { useHistory, useRanking } from '../api/queries'
import { loadOptions } from '../settings/options'
import { loadPlayer, type PlayerProfile } from '../settings/player'
import { formatPlayedAt, formatTime } from './format'

export type RecordsTab = 'ranking' | 'history'

const TABS: readonly { id: RecordsTab; label: string }[] = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match History' },
]

const CONTROLS = '/png/default/ui/controls'

interface RecordsScreenProps {
  initialTab: RecordsTab
  onBack: () => void
}

/** "Captain's Log": the Ranking and Match History tabs of the main menu. */
export function RecordsScreen({ initialTab, onBack }: RecordsScreenProps) {
  const [tab, setTab] = useState<RecordsTab>(initialTab)
  const [player] = useState(loadPlayer)
  // The ranking compares matches played with the player's current settings.
  const [config] = useState<MatchConfig>(() => {
    const { sessionSeconds, spawnIntervalSeconds } = loadOptions()
    return { sessionSeconds, spawnIntervalSeconds }
  })
  const tabRefs = useRef<Partial<Record<RecordsTab, HTMLButtonElement | null>>>({})

  /** WAI-ARIA tabs: arrow keys move between tabs. */
  const onTabKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next: RecordsTab = tab === 'ranking' ? 'history' : 'ranking'
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <main className="screen">
      <div className="panel records-panel">
        <h1>Captain&apos;s Log</h1>

        <div className="records-tabs" role="tablist" aria-label="Records" onKeyDown={onTabKeyDown}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              ref={(element) => {
                tabRefs.current[id] = element
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              className={`btn ${tab === id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="records-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {/* Switching tabs remounts it: the cached page shows at once and refreshes in the background. */}
          {tab === 'ranking' ? <RankingTab config={config} player={player} /> : <HistoryTab player={player} />}
        </div>

        <button type="button" className="btn btn-primary" onClick={onBack} data-sound="back" autoFocus>
          Main Menu
        </button>
      </div>
    </main>
  )
}

function RankingTab({ config, player }: { config: MatchConfig; player: PlayerProfile }) {
  const [page, setPage] = useState(1)
  const query = useRanking(config, page)

  return (
    <>
      <p className="records-subtitle">
        {config.sessionSeconds} second battles · {config.spawnIntervalSeconds} second spawn interval
      </p>
      <PagedResults
        query={query}
        page={page}
        onPageChange={setPage}
        emptyMessage="No battles with these settings yet. Be the first to set a record!"
        renderTable={(entries: RankingEntry[]) => (
          <table className="records-table">
            <caption className="sr-only">Ranking</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Captain</th>
                <th scope="col">Points</th>
                <th scope="col">Played</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isYou = entry.playerId === player.id
                return (
                  <tr key={entry.matchId} className={isYou ? 'is-you' : undefined}>
                    <td className="records-rank">{String(entry.rank).padStart(2, '0')}</td>
                    <td>
                      {entry.rank === 1 && <img className="records-star" src="/png/default/ui/hud/icon_score.png" alt="" />}
                      {entry.playerName}
                      {isYou && <span className="records-badge">You</span>}
                    </td>
                    <td className="records-points">{entry.score}</td>
                    <td className="records-date">{formatPlayedAt(entry.finishedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      />
    </>
  )
}

function HistoryTab({ player }: { player: PlayerProfile }) {
  const [page, setPage] = useState(1)
  const query = useHistory(player.id, page)
  const pending = useSyncExternalStore(pendingMatches.subscribe, pendingMatches.getSnapshot).filter(
    (item) => item.record.playerId === player.id,
  )
  const failed = pending.filter((item) => item.status === 'failed')

  return (
    <>
      <p className="records-subtitle">{player.name} · your recent battles</p>

      {pending.length > 0 && (
        <div className="records-pending" role="status">
          <span>
            {pending.length} {pending.length === 1 ? 'battle is' : 'battles are'} waiting to be saved
            {failed.length > 0 ? ` (${failed[0].error})` : '…'}
          </span>
          {failed.length > 0 && (
            <button type="button" className="link-button" onClick={() => pendingMatches.retryFailed()}>
              Retry now
            </button>
          )}
        </div>
      )}

      <PagedResults
        query={query}
        page={page}
        onPageChange={setPage}
        emptyMessage="No battles recorded yet. Finish a match to start your log."
        renderTable={(matches: MatchRecord[]) => (
          <table className="records-table">
            <caption className="sr-only">Match history</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Points</th>
                <th scope="col">Duration</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr key={match.matchId}>
                  <td className="records-date">{formatPlayedAt(match.finishedAt)}</td>
                  <td className="records-points">{match.score}</td>
                  <td>{formatTime(match.durationSeconds)}</td>
                  <td className={match.endReason === 'death' ? 'records-defeated' : 'records-time-up'}>
                    {match.endReason === 'death' ? 'Defeated' : 'Time up'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />
    </>
  )
}

interface PagedResultsProps<T> {
  query: UseQueryResult<Page<T>>
  page: number
  onPageChange: (page: number) => void
  emptyMessage: string
  renderTable: (items: T[]) => ReactNode
}

/** Loading, error, empty, background refresh and pagination, shared by both tabs. */
function PagedResults<T>({ query, page, onPageChange, emptyMessage, renderTable }: PagedResultsProps<T>) {
  const { data, isPending, isError, error, isFetching, isPlaceholderData, refetch } = query
  const totalPages = data?.totalPages ?? 1

  // The list can shrink (e.g. after a reset): never stay on a page that no longer exists.
  useEffect(() => {
    if (!isPlaceholderData && page > totalPages) onPageChange(totalPages)
  }, [isPlaceholderData, page, totalPages, onPageChange])

  if (isPending) {
    return (
      <p className="records-message" role="status">
        Loading…
      </p>
    )
  }

  if (!data) {
    return (
      <div className="records-message" role="alert">
        <p>Could not load this list. {describeApiError(error)}</p>
        <button type="button" className="link-button" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Background refresh: the current list stays visible while it updates. */}
      <p className="records-refresh" role="status">
        {isFetching ? 'Updating…' : isError ? `Could not refresh. ${describeApiError(error)}` : ''}
      </p>

      {data.totalItems === 0 ? (
        <p className="records-message">{emptyMessage}</p>
      ) : (
        <div className={`records-table-wrap${isPlaceholderData ? ' is-stale' : ''}`}>{renderTable(data.items)}</div>
      )}

      {data.totalPages > 1 && (
        <nav className="pagination" aria-label="Pages">
          <button
            type="button"
            className="round-button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <img src={`${CONTROLS}/icon_turn_left.png`} alt="" />
          </button>
          <span>
            Page {page} of {data.totalPages}
          </span>
          <button
            type="button"
            className="round-button"
            aria-label="Next page"
            disabled={page >= data.totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <img src={`${CONTROLS}/icon_turn_right.png`} alt="" />
          </button>
        </nav>
      )}
    </>
  )
}
