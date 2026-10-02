# Pirate Battle

A top-down 2D naval shooter built with **React 19**, **TypeScript (strict)** and **PixiJS 8**.
Sail between islands, sink enemy ships and score as many points as you can before the timer runs out.

| | |
| --- | --- |
| **Live demo** | _add the deployed URL here_ |
| **Architecture** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **Profiling report** | [PERFORMANCE.md](PERFORMANCE.md) |
| **Challenge statement** | [docs/CHALLENGE.md](docs/CHALLENGE.md) |

## Contents

- [What is delivered](#what-is-delivered)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Commands](#commands)
- [Controls](#controls)
- [Gameplay configuration](#gameplay-configuration)
- [Ranking and match history](#ranking-and-match-history)
- [Network scenarios (mock API)](#network-scenarios-mock-api)
- [Reproducing failures](#reproducing-failures)
- [Tests (Playwright)](#tests-playwright)
- [Performance](#performance)
- [Deploy](#deploy)
- [Project structure](#project-structure)
- [Assets and licenses](#assets-and-licenses)

## What is delivered

| Item | Where |
| --- | --- |
| Source code | [src/](src/) |
| Lockfile | [package-lock.json](package-lock.json) (install with `npm ci`) |
| Assets | [assets/](assets/), the provided pack, served as-is |
| API mocks (MSW) | [src/mocks/](src/mocks/): handlers, mock database, network scenarios; service worker in [assets/mockServiceWorker.js](assets/mockServiceWorker.js) |
| Fixtures | [src/mocks/fixtures.ts](src/mocks/fixtures.ts): 33 matches by other captains over 3 configurations, deterministic |
| Shared API contracts | [src/api/contracts.ts](src/api/contracts.ts), used by both the client and the mocks |
| E2E and visual tests | [e2e/](e2e/), with versioned screenshot baselines in [e2e/visual.spec.ts-snapshots/](e2e/visual.spec.ts-snapshots/) |
| Test report | HTML report in `playwright-report/` and failure traces in `test-results/`, created by every run ([details](#reports-and-traces)) |
| Profiling report | [PERFORMANCE.md](PERFORMANCE.md), with the raw results in [perf/results/](perf/results/) |

Everything runs from a clean checkout, with no private service: the ranking and history API is the
MSW mock, which runs in the browser in every build.

## Setup

Requirements: **Node.js 22** (Vite 8 needs 20.19+ or 22.12+) and **npm 10+**.

```bash
git clone <repository-url> pirate-battle
cd pirate-battle
npm ci                               # exact versions from the lockfile
npm run dev                          # http://localhost:5173
```

To run the Playwright tests or the profiling, also install the browser once:

```bash
npx playwright install chromium      # add --with-deps on a fresh Linux machine or CI
```

## Environment variables

**The app needs none.** There is no `.env` file, no API key and no backend URL: the mock API starts by
itself in development, in `npm run preview` and in the deployed site.

Optional variables used only by the test and profiling tooling:

| Variable | Used by | Effect |
| --- | --- | --- |
| `CI` | `npm run test:e2e`, `npm run perf` | Forbids `test.only`, retries a failing test once, and always starts a fresh preview server instead of reusing one |
| `PERF_SESSION_SECONDS` | `npm run perf` | Length of the benchmark match (default `180`) |
| `APP_URL` | `perf/memory-investigation.mjs` | App to profile (default `http://localhost:4173`) |
| `CYCLES`, `PLAY_MS`, `SNAP_FROM` | `perf/memory-investigation.mjs` | Number of cycles, play time per cycle, and the cycle of the first heap snapshot |
| `CONTROL=1` | `perf/memory-investigation.mjs` | Control run: opens Options instead of playing |
| `BLOCK_SW=1` | `perf/memory-investigation.mjs` | Blocks service workers, so the run has no MSW |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload (`http://localhost:5173`) |
| `npm run build` | Type-check, then build the production bundle into `dist/` |
| `npm run preview` | Serve the production build (`http://localhost:4173`) |
| `npm run lint` | Lint with oxlint |
| `npm run typecheck` | TypeScript type check (strict mode) |
| `npm run test:e2e` | Build, start the preview server and run the Playwright suite (desktop + mobile) |
| `npm run test:e2e:update` | Same, rewriting the visual baselines |
| `npm run test:e2e:report` | Open the HTML report of the last run |
| `npm run perf` | Profiling of a three-minute match and of five play cycles (see [PERFORMANCE.md](PERFORMANCE.md)) |

Useful Playwright variations:

```bash
npx playwright test --project desktop          # desktop only
npx playwright test --project mobile           # Pixel 7 in landscape only
npx playwright test records                    # one spec file (e2e/records.spec.ts)
npx playwright test -g "pause"                 # tests whose title matches
npx playwright test --headed --workers 1       # watch it run
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail forward | `W` / `↑` | Push the joystick (left side): the farther, the faster |
| Turn left / right | `A` `D` / `←` `→` | Drag the joystick towards the new heading; a small push only turns |
| Front cannon | `Space` | Center button (right side) |
| Left / right broadside | `Q` / `E` | Side buttons (right side) |
| Pause / resume | `Esc` / `P` | Pause button (top right) |

- Moving and firing at the same time works with the keyboard and with multi-touch.
- The match pauses by itself when the window loses focus or the tab is hidden. Resuming always needs
  a player action.
- On phones the game is played in **landscape**. Turning the phone to portrait pauses the match.
- Game keys are only captured while a match is running, so menus keep normal keyboard navigation.
- The controls are also listed on the main menu.

## Gameplay configuration

All balance values live in one typed object, `DEFAULT_CONFIG` in
[src/game/config.ts](src/game/config.ts). Changing balance only means editing that object, never the
systems. Units: pixels, seconds and radians.

| Group | Main values |
| --- | --- |
| Arena | 1600 × 900, 64 px tiles, 4 islands, island hitbox inset 10 px |
| Match | 60 s |
| Player | 100 HP, 210 px/s, turns at 2.4 rad/s |
| Front cannon | 30 damage, cooldown 0.4 s, 520 px/s for 1.2 s (range ≈ 624 px) |
| Broadsides | 3 parallel balls × 15 damage, cooldown 1.5 s per side, 460 px/s for 0.9 s (range ≈ 414 px) |
| Chaser | 30 HP, 165 px/s, 20 contact damage |
| Shooter | 50 HP, 110 px/s, fires from 420 px, holds at 300 px; 8 damage, cooldown 2 s |
| Spawning | every 3 s after a 2 s delay; pattern Chaser, Shooter, Chaser; every fourth spawn is a pair; at least 450 px from the player; at most 10 enemies alive |

The reasons behind these numbers are in [ARCHITECTURE.md § Balancing decisions](ARCHITECTURE.md#10-balancing-decisions).

The **Options** screen exposes two of them, validates them and keeps them in `localStorage`, so they
survive a refresh:

| Option | Limits | Default |
| --- | --- | --- |
| Game session time | 60–180 s, whole seconds | 60 s |
| Enemy spawn time | 0.5–10 s (must be positive; below 0.5 s the arena fills at once, above 10 s it stays empty) | 3 s |

Each match takes a snapshot of the configuration when it starts; changes only apply to the next
match. Options also holds the captain name shown in the ranking, the sound toggle and the network
simulation panel.

## Ranking and match history

- Each browser gets a player id (stored locally) and an editable captain name. The other captains
  come from the fixtures.
- The ranking only compares matches played with the **same session time and spawn interval** as the
  current Options. Ties are broken by shorter duration, then earlier date, then match id.
- A finished match is queued locally the moment it ends and sent in the background. The result
  screen shows whether it was saved. A match that could not be sent stays on the device, survives a
  refresh and can be retried. Sending the same match again never creates a duplicate.
- Refreshing or leaving during a match abandons it: nothing is registered.
- If the API fails, the game, the Options and a running match keep working.

## Network scenarios (mock API)

The ranking and history API only exists as an MSW mock running in the browser, in every build.

**Select a scenario:** Options → *Network simulation (mock API)* → *Scenario*, or open the app with
`?scenario=<id>`. The choice is saved and survives a refresh.

**Reset:** *Reset mock data* in the same panel restores the fixtures and the `success` scenario and
clears the cached lists. Matches still pending on the device are kept and sent again. To start from
nothing at all, also clear the site data in the browser (DevTools → Application → Clear site data).

| Scenario id | Effect |
| --- | --- |
| `success` | Normal latency (150–400 ms) |
| `empty` | Ranking and history answer with no matches |
| `slow` | Every response takes about 2.5 s |
| `variable-latency` | 100–3000 ms per request, so responses arrive out of order |
| `timeout` | The server never answers; requests time out |
| `offline` | Connection failure on every request |
| `server-error` | Every request fails with HTTP 500 |
| `client-error` | Every request is rejected with HTTP 400 |
| `ranking-down` | Only the ranking fails (HTTP 503) |
| `history-down` | Only the match history fails (HTTP 503) |
| `register-timeout` | The match is saved, but the first response is lost; the retry must not duplicate it |

Client behavior: requests time out after **4 s**. Network errors, timeouts and 5xx responses are
retried twice (after 0.5 s, then 1 s); a 4xx fails at once.

**Reproducible runs.** These URL parameters can be combined with any scenario:

| URL parameter | Effect |
| --- | --- |
| `?scenario=<id>` | Selects (and saves) a network scenario |
| `?mockSeed=123` | Makes the random mock latencies reproducible |
| `?mockLatency=0` | Replaces every scenario latency with a fixed value in ms |
| `?seed=123` | Fixed seed for the match: the same spawns every time |
| `?test` | Exposes the running match to tests as `window.__PIRATE_BATTLE__` (read the state, count display objects) |
| `?test&clock=manual` | Test clock: the match only advances through `window.__PIRATE_BATTLE__.advance(seconds)` |

Example: `http://localhost:5173/?seed=42&mockLatency=0&scenario=empty`.

## Reproducing failures

All of these work in `npm run dev`, `npm run preview` and the deployed site.

| What to see | Steps |
| --- | --- |
| Error state on a list | Choose `server-error` (or `ranking-down` / `history-down`) and open Ranking or Match History. The error appears after the retries, with a *Try again* button. |
| Empty state | Choose `empty` and open either tab. |
| Background refresh and out-of-order answers | Choose `variable-latency` (or `slow`) and switch pages or tabs quickly. The current list stays on screen with *Updating…*, and a late answer never replaces newer data. |
| Timeout | Choose `timeout` and open a tab. Each attempt waits 4 s, so the error shows after about 13.5 s. |
| API down when the match ends, then recovery | Choose `offline` and finish a match: the result screen says it was not saved, and Match History lists it as pending. Refresh the page: it is still pending. Switch back to `success` (it is sent right away) or press *Retry*. |
| Timeout after registering, without duplication | Choose `register-timeout` and finish a match. The first answer is lost; after the 4 s timeout the client retries and receives the stored record. The match appears once in the ranking and once in the history. |
| Asset loading failure and retry | In Chrome DevTools → Network, check *Disable cache* and set throttling to *Offline*, then press **Play**: the loading screen shows an error and no combat starts. Set throttling back to *No throttling* and press *Retry*. |
| Reaching the end of a match quickly | For the cases above, set *Enemy spawn time* to 0.5 s in Options and stay still: the enemies sink the ship in well under a minute. |

Each of these is also covered by an automated test (see below), which is the most reliable way to
reproduce them: for example `npx playwright test records` or `npx playwright test assets`.

## Tests (Playwright)

The suite runs against the production build (`vite build` + `vite preview`), the same bundle that is
deployed. Every test starts in a fresh browser context, so storage, the mock database and the service
worker start from scratch.

- **Projects:** `desktop` (Desktop Chrome, 24 tests) and `mobile` (Pixel 7 in landscape, 6 tests
  tagged `@mobile`: the main flows, touch controls and the screenshots). 30 tests in total, all in
  Chromium.
- **Reproducible:** fixed match seed, instant mock answers (`mockLatency=0`) and the test clock
  (`clock=manual`), which plays match time through the same frame code as the real loop. Combat tests
  press the real keys or touch controls and check the effects on the simulation.

| Challenge item | Spec |
| --- | --- |
| 1. Navigation, validation and persistence of options | [options.spec.ts](e2e/options.spec.ts) |
| 2. Asset loading, failure and retry | [assets.spec.ts](e2e/assets.spec.ts) |
| 3. Start, movement, rotation, arena limits, islands | [movement.spec.ts](e2e/movement.spec.ts) |
| 4. Front and side fire, damage, cooldown, score without duplication | [combat.spec.ts](e2e/combat.spec.ts) |
| 5. Chaser and Shooter behavior, spawn interval | [combat.spec.ts](e2e/combat.spec.ts) |
| 6. End by time and by death, frozen simulation, clean restart | [match.spec.ts](e2e/match.spec.ts) |
| 7. Pause, focus loss, resume without the timer moving | [match.spec.ts](e2e/match.spec.ts) |
| 8. Result screen and its persistence after a refresh | [match.spec.ts](e2e/match.spec.ts) |
| 9. Abandoning a match, repeated navigation, touch controls | [match.spec.ts](e2e/match.spec.ts), [touch.spec.ts](e2e/touch.spec.ts) |
| 10. Ranking and Match History: paging, loading, empty, error | [records.spec.ts](e2e/records.spec.ts) |
| 11. Registration, both tabs updated, pending send recovered after a refresh | [records.spec.ts](e2e/records.spec.ts) |
| 12. Retry after timeout without duplication, late answers not overwriting newer data | [records.spec.ts](e2e/records.spec.ts) |
| Visual regression: menu, arena in a stable state, result screen | [visual.spec.ts](e2e/visual.spec.ts) |

### Reports and traces

- `npm run test:e2e` writes the **HTML report** to `playwright-report/index.html`. Open it with
  `npm run test:e2e:report`.
- A failing test keeps its **trace** and a screenshot in `test-results/<test>/`. The trace is
  attached to the HTML report, or can be opened with `npx playwright show-trace test-results/<test>/trace.zip`.
- **Visual baselines** are versioned for Linux (`*-linux.png`), the platform they were recorded on.
  On macOS or Windows, font and GPU differences change the pixels: run the visual tests on Linux, or
  record local baselines with `npm run test:e2e:update` without committing them.

## Performance

Measured on the production build: **60 FPS for a whole three-minute match at the heaviest load the
rules allow**, frame time p95 16.7 ms, at most 10 enemies and 245 display objects. Memory stays flat
over five play cycles once a leak in the audio loops was fixed. Hardware, browser, resolution,
benchmark configuration, raw results and limitations are in [PERFORMANCE.md](PERFORMANCE.md).

## Deploy

The app is a static site with a single page, so opening or refreshing the URL always works.

- **Vercel:** import the repository and keep the detected **Vite** preset (build command
  `npm run build`, output directory `dist`). No environment variables are needed.
- With the Git integration, each push to `main` deploys again, so the published version matches the
  delivered code.
- The MSW service worker (`mockServiceWorker.js`) is served from the site root, so the mocked ranking
  and history also work in the deployed build.

## Project structure

```
src/
  App.tsx                 screen navigation (menu, options, play, result, records)
  main.tsx                starts the mock API, then renders the app
  storage.ts              localStorage/sessionStorage helpers that never throw
  game/
    config.ts             typed gameplay configuration
    GameEngine.ts         owns the PixiJS Application, the loop, pause and cleanup
    assets.ts             texture manifest + loading with progress and retry
    testHooks.ts          test-only window into the match (?test)
    input/                keyboard/touch → player intent
    sim/                  pure game rules (no PixiJS, no React)
    render/               PixiJS views (arena, ships, projectiles, effects)
    audio/                match sounds, driven by simulation events
    store/GameStore.ts    simulation → React bridge (useSyncExternalStore)
  api/                    contracts, Axios client, TanStack Query hooks, pending-match queue
  mocks/                  MSW handlers, mock database, fixtures, network scenarios
  audio/                  sound loading/playback and menu sounds
  settings/               persisted options, player profile and last result
  ui/                     React screens, HUD, dialogs, touch controls
e2e/                      Playwright E2E and visual tests
perf/                     profiling scripts and their results
assets/                   provided asset pack (served as-is) + MSW service worker
docs/CHALLENGE.md         the challenge statement
```

## Assets and licenses

Only the asset pack provided with the challenge (`assets/`: images, UI sprites and sounds) is used.
No third-party assets, fonts or sounds were added.
