# Architecture

How Pirate Battle is built and why. Setup, commands and controls are in the [README](README.md);
profiling evidence is in [PERFORMANCE.md](PERFORMANCE.md).

| Topic | Section |
| --- | --- |
| React/PixiJS integration | [2. React ↔ PixiJS integration](#2-react--pixijs-integration) |
| Simulation loop, pause and focus | [3. Simulation loop](#3-simulation-loop) |
| Collisions | [4. Collisions](#4-collisions) |
| Enemies and spawning | [5. Enemies and spawning](#5-enemies-and-spawning) |
| Resource management | [6. Resource management](#6-resource-management) |
| Local persistence | [7. Local persistence](#7-local-persistence) |
| Ranking and history: contracts, cache, pending registrations, mocks | [8. Ranking and match history](#8-ranking-and-match-history) |
| Test instrumentation | [9. Test instrumentation](#9-test-instrumentation) |
| Balancing decisions | [10. Balancing decisions](#10-balancing-decisions) |
| Limitations | [11. Known limitations](#11-known-limitations) |

## 1. Layers

```
            ┌──────────────────────── React ────────────────────────┐
            │ App (screens) · Hud · MatchOverlay · TouchControls     │
            └──────▲───────────────────────────────┬────────────────┘
       GameStore (useSyncExternalStore)     commands (pause, resume, setAction, setSteering)
                   │                               ▼
            ┌──────┴──────────────── GameEngine ─────────────────────┐
            │ PixiJS Application · Ticker loop · InputManager        │
            │      │ intent                    ▲ reads state/events │
            │      ▼                           │                    │
            │  sim/ (pure rules)  ───────►  render/ + audio/        │
            └────────────────────────────────────────────────────────┘
```

| Layer | Folder | Knows about |
| --- | --- | --- |
| Rules / simulation | `src/game/sim` | Plain TypeScript only. No PixiJS, no React, no DOM. |
| Rendering | `src/game/render` | PixiJS. Reads the simulation state, never changes it. |
| Input | `src/game/input` | DOM keyboard events → `PlayerIntent`. Touch controls feed the same state. |
| Audio | `src/game/audio`, `src/audio` | Reacts to simulation events and state, like the render layer. |
| Orchestration | `src/game/GameEngine.ts` | Owns one match: Pixi app, world, input, audio, loop, pause, cleanup. |
| UI | `src/ui`, `src/App.tsx` | React screens, HUD and dialogs. Never touches Pixi objects. |
| Ranking / history | `src/api`, `src/mocks` | Axios + TanStack Query against an MSW mock. Independent from the game. |

The continuous state of the combat (positions, HP, cooldowns, projectiles, timer) lives only in the
simulation. React only sees a small, rounded summary of it.

## 2. React ↔ PixiJS integration

- **One bridge.** `GameCanvas` is the only place where React meets PixiJS. React owns a host `<div>`;
  the engine owns everything inside it. The component renders once per match, and the game loop
  never causes React renders.
- **Lifecycle and StrictMode.** `GameEngine.mount()` is async (PixiJS 8 `app.init()`). StrictMode
  mounts, unmounts and mounts again, so the first engine is destroyed while `init` is still pending.
  `destroy()` sets a `destroyed` flag; when `init` resolves, a destroyed engine throws its app away.
  The result is exactly one canvas and one set of listeners. An E2E test repeats menu ↔ match cycles
  and checks that only one canvas is ever left.
- **Simulation → UI.** The engine calls `GameStore.update()` every frame with rounded values (HP,
  score, whole seconds left, status). The store only notifies subscribers when a value changes, so
  the HUD re-renders about once per second. React subscribes with `useSyncExternalStore`.
- **UI → simulation.** React calls engine methods through a ref: `pause()`, `resume()`,
  `setAction(action, down)` for the touch buttons and `setSteering(steering)` for the joystick.
- **Semantic HUD.** The HUD is React DOM, not Pixi: health is a labelled `meter`, score and time are
  labelled text. A polite live region announces only state changes (paused, match over), never the
  ticking timer.
- **End of match.** When the store reports `over`, `MatchOverlay` calls `onFinish` right away: `App`
  saves the last result, queues the match for registration and marks the session as showing a
  result. Only then does a 1.5 s banner play before the result screen opens. Recording first means
  a refresh during the banner cannot lose a finished match. `finish` is idempotent per match id.
- **Restart.** Every match gets a new `GameScreen` key, so a restart destroys the old engine and
  builds a new one. No state is carried over.
- **Configuration snapshot.** `App` builds the match config from `DEFAULT_CONFIG` and the saved
  Options when the match starts (`buildMatchConfig`). The engine keeps that copy, so changing Options
  later only affects the next match.

## 3. Simulation loop

- The Pixi `Ticker` (requestAnimationFrame) calls `GameEngine.tick`, which runs one frame:
  input → simulation → effects and audio → views → HUD store.
- **Time-based.** Every speed is in px/s and every cooldown and timer in seconds, multiplied by `dt`.
  Movement, damage over time, cooldowns and spawns never depend on the frame rate.
- **Sub-stepping.** A slow frame is split into steps of at most 1/30 s, so game time keeps up with
  real time even at low FPS, and projectiles never move far enough in one step to tunnel through
  ships. Frames longer than 250 ms are treated as hitches and capped.
- **Order of one step** (`sim/world.ts`, `updateWorld`):
  1. Move the player (intent) and the enemies (AI).
  2. Ship collisions: Chaser contact, separation, then push out of islands and clamp to the arena.
  3. Weapons, projectile movement, projectile hits.
  4. Remove dead projectiles and enemies.
  5. End conditions (death, time), then spawning.
- **Events.** The simulation reports one-shot facts as events (`shot`, `hit`, `splash`, `impact`,
  `ram`, `destroyed`). The effects layer and the audio turn them into feedback, so the rules never
  draw or play anything.
- **End of match.** When `status` becomes `over`, `updateWorld` returns early: nothing moves, fires,
  takes damage, spawns or scores. Inside the step where the player sinks, the player's weapons and
  shots stop at once, so no point is scored after the end.
- **Determinism.** The simulation uses a seeded PRNG (`sim/random.ts`, mulberry32), never
  `Math.random`. `?seed=N` replays the same match.

### Pause and focus

- Pausing stops the Pixi ticker. The match timer, cooldowns, movement and effects only advance inside
  the loop, so they freeze with it. Held keys and the joystick are dropped, and game keys are ignored
  until the match resumes.
- Esc/P toggles the pause. `blur` and `visibilitychange` (hidden tab) pause automatically. On touch
  devices, rotating to portrait also pauses.
- Resuming always needs a player action. `Ticker.start()` resets its clock, so the paused time is
  never simulated and nothing "catches up".
- After the match ends, input is disabled so the keyboard drives the dialogs again.

## 4. Collisions

There is no physics library (`sim/collision.ts`):

- Ships and cannonballs are **circles**; islands are **axis-aligned rectangles**, slightly inset so
  the rounded island art feels fair.
- **Circle vs rectangle:** find the closest point of the rectangle to the circle center. A ship
  overlapping an island is pushed out along that normal, which lets it slide along edges.
- **Circle vs circle:** compare squared distances, with no `sqrt` on the hot path.
- **Arena limits:** ships are clamped inside the arena; projectiles that leave it are removed.
- **Projectiles** are removed when they hit a target or an island, leave the arena or expire. A
  projectile is marked dead on its first hit, so it can never apply damage twice.
- **Dead enemies** are removed in the same step, so they no longer deal damage, fire or collide.
- **Scoring.** Only enemies destroyed by player projectiles score, and only while the player is
  afloat. A Chaser ramming the player is removed without going through `damageShip`, so its
  self-destruction never counts as a kill.

## 5. Enemies and spawning

- **Chaser:** steers towards the player at full speed, deals contact damage and explodes.
- **Shooter:** approaches until `preferredDistance`, keeps aiming with the bow, and fires when the
  player is within `attackRange` and the aim error is below `aimTolerance`.
- **Steering.** Turning is proportional (`diff / (turnSpeed * dt)`, clamped), so ships settle on a
  heading instead of wobbling. The touch joystick uses the same steering for the player.
- **Island avoidance.** If a probe point 90 px ahead of the bow is inside an island, the ship steers
  90° away from the island center and slides around it.
- **Spawner** (`sim/spawner.ts`): one spawn every `intervalSeconds`. After every `group.every` single
  spawns, the next one brings `group.size` enemies at once (default: 3 singles, then a pair). Each
  enemy takes the next type of a configurable `pattern`, which guarantees both types appear in a
  default match.
- **Spawn points** come from rejection sampling: inside the arena, clear of islands and enemies, and
  at least `minDistanceFromPlayer` away, so no hit is unavoidable at spawn. The spots of a group are
  all picked before anyone is created, and each one also avoids the spots already picked, so members
  never appear at the same point. If a spot cannot be found, the whole group retries 0.25 s later.
  `maxEnemies` is a hard cap: no spawn happens while it is reached, and a group near the cap comes in
  smaller.

## 6. Resource management

### Textures and loading

- Textures are loaded once with `Assets.load` (`src/game/assets.ts`) before the arena mounts, with a
  progress bar, an error state and a *Retry* button. Combat never starts without its textures.
- Every later match reuses them from the Assets cache. Concurrent callers (StrictMode) share one
  request.

### Scene

- **Arena:** a single `TilingSprite` for the water, plus 9-slice tiles for the islands and the
  shallow-water halo. It is built once and has no per-frame work.
- **Ships:** `ShipView` changes the sprite through 4 wear stages based on HP (intact, damaged, badly
  damaged, wreck), flashes red when hit, shows fire below 1/3 HP, and has a health bar that does not
  rotate. Health bars crop the fill texture following the atlas `fill_rect` metadata, and the cropped
  texture is only rebuilt when the HP changes.
- **Projectiles** use a sprite pool, so dead cannonballs hand their sprite to the next shot.
- **Effects** (muzzle flash, splash, hit, explosion, sinking wreck) are driven by the engine `dt`. The
  explosion `AnimatedSprite` uses `autoUpdate: false`, so it freezes while paused. One shared
  `GraphicsContext` is used for all splash rings.

### Screen fitting

- The arena has a fixed logical size (1600×900). The world container is scaled with
  `min(scaleX, scaleY)` and centered (letterbox), so proportions and rules never depend on the screen.
- The renderer resizes with its host and uses `resolution = devicePixelRatio` (capped at 2) with
  `autoDensity`, so the canvas is sharp on HiDPI screens while its CSS size matches the host.
- The simulation never sees screen pixels. Touch input is converted to a heading relative to the
  screen, which has the same orientation as the arena.

### Cleanup

`GameEngine.destroy()` runs when the player leaves, restarts, or the component unmounts:

1. removes the keyboard, `blur`, `visibilitychange` and renderer resize listeners, and the ticker
   callback;
2. stops and releases the audio loops;
3. removes the test hook from `window`, if it was installed;
4. calls `app.destroy({ removeView: true }, { children: true })`, which destroys the canvas and
   every display object while keeping the shared textures. Owned resources (cropped health
   textures, the shared ring geometry) are destroyed explicitly.

Over five cycles of play and leave, DOM nodes and canvases stay constant, listeners fluctuate without
a trend, and no game object survives a match (heap snapshots in
[PERFORMANCE.md](PERFORMANCE.md#memory-investigation)).

### Audio

- `@pixi/sound` is imported on the first click, tap or key press. Browsers block audio before a user
  gesture anyway, and this keeps it out of the main bundle.
- Every WAV in `assets/sounds` preloads in the background. A sound that is not loaded yet is skipped
  (a late sound is worse than none), and a failed load only logs a warning.
- `GameAudio` maps simulation events to sounds, runs the ocean and sailing loops (sailing volume
  follows the player's speed), ticks during the last 5 seconds and warns once at low health. The same
  sound is not restarted within 60 ms, so a 3-ball broadside plays one sound.
- **Pause stops the loops instead of pausing them**, and they start again on resume. @pixi/sound only
  releases an instance that is playing, so a paused loop left behind by a match stayed in memory
  forever. This leak was found while profiling.
- Menu sounds come from two delegated `document` listeners; buttons pick their sound with
  `data-sound`. The mute toggle in Options is persisted.

## 7. Local persistence

| Key | Storage | Content |
| --- | --- | --- |
| `pirate-battle:options` | localStorage | Session time and spawn interval, validated on load (falls back to defaults) |
| `pirate-battle:player` | localStorage | Player id (UUID) and captain name |
| `pirate-battle:last-result` | localStorage | Last finished match: id, score, time played, end reason, date, options used |
| `pirate-battle:pending-matches` | localStorage | Finished matches not yet confirmed by the API, with their send status |
| `pirate-battle:sound-enabled` | localStorage | Sound toggle |
| `pirate-battle:mock-db` | localStorage | Mock server data: fixtures plus confirmed matches |
| `pirate-battle:mock-scenario` | localStorage | Selected network scenario |
| `pirate-battle:showing-result` | sessionStorage | A refresh on the result screen (or during the end banner) shows the result again |

- Storage access never throws: `src/storage.ts` wraps it (private windows, blocked storage, full
  quota), and callers validate the shape of the stored data before using it.
- Refreshing or leaving during a match abandons it. Nothing is saved or registered for an abandoned
  match.

## 8. Ranking and match history

### Contracts

`src/api/contracts.ts` is shared by the client and the MSW handlers, so both sides agree on paths,
payloads and errors.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/ranking?page&pageSize&sessionSeconds&spawnIntervalSeconds` | Ranking page for one config, best first, with `rank` |
| `GET` | `/api/players/:playerId/matches?page&pageSize` | The player's history, newest first |
| `PUT` | `/api/matches/:matchId` | Idempotent registration: `201` when created, `200` with the stored record when it already exists |

- A `MatchRecord` has `matchId`, `playerId`, `playerName`, `finishedAt`, `score`, `durationSeconds`
  (active play, pauses excluded), `endReason` and the `config` used (session time and spawn interval).
- Pages carry `items`, `page`, `pageSize`, `totalItems` and `totalPages`. Errors use
  `{ error, message }`.
- **Ranking order** (`compareForRanking`): higher score, then shorter duration, then earlier date,
  then match id, so the order is always deterministic. Only matches with the same config are compared.
- **Why `PUT` with a client id.** The match id is generated when the match starts
  (`crypto.randomUUID()`), so it doubles as the idempotency key. A retry after a timeout, a double
  click or a resend after a refresh all hit the same resource, and the server returns the stored
  record instead of inserting it again. One finished match is one history entry and one ranking entry.

### Client and cache (Axios + TanStack Query)

- One Axios instance with a 4 s timeout. TanStack Query's `AbortSignal` is passed through, so
  requests that are no longer wanted are cancelled.
- **Query keys** all start with `['records']`, with one key per page (ranking: config + page;
  history: player + page). One invalidation refreshes both tabs.
- **Freshness.** `staleTime: 0`, and each tab remounts when shown: the cached page appears at once and
  refetches in the background (*Updating…*). Window focus also refetches. Unused pages stay cached
  for 5 minutes.
- **Paging** uses `keepPreviousData`, so the current page stays visible (dimmed) while the next one
  loads.
- **Retries.** Network errors, timeouts and 5xx are retried twice (0.5 s, then 1 s); a 4xx is final.
  Queries and the registration mutation share this policy.
- **Out-of-order answers.** Each page has its own key, so a slow answer for page 1 cannot land on
  page 2. Invalidation cancels the request in flight, so an older answer cannot overwrite newer data.
- **States.** Loading, empty, error (with *Try again*), background refresh, and a background error
  that keeps the last good data on screen.
- **Isolation.** API failures only show in the Ranking and Match History tabs and on the result
  screen. Play, Options and a running match never wait for the API.

### Pending registrations

`src/api/pendingMatches.ts` (an external store) and `src/api/useMatchSync.ts` (mounted once at the
app root):

- A finished match is added as `queued` the moment it ends. `useMatchSync` sends each queued item with
  a TanStack Query mutation and marks it `sending`. It runs on every screen, including during a new
  match, and never blocks the game.
- **Success:** the item is removed and `['records']` is invalidated, so both tabs show the match.
- **Failure:** the item becomes `failed` with a readable message. It is retried by the *Retry*
  buttons (result screen, Match History), by the browser `online` event, or by changing the scenario
  in Options. A retry is ignored unless the item failed, so repeated clicks never send twice.
- **Refresh.** The list is persisted on every change. After a refresh, an item that was `sending`
  becomes `queued` again; resending is safe because the `PUT` is idempotent.

### Mock server (MSW)

- `setupWorker` starts before the first render in every build (dev, preview and the deployed site).
  If it cannot start, the game still opens and only the ranking and history fail. Requests the mock
  does not handle (textures, sounds) go to the network untouched.
- The handlers use the shared contracts. The mock database lives in localStorage and starts from
  deterministic fixtures (33 matches over 3 configs, fixed seed and fixed dates), so confirmed
  matches survive a refresh and both tabs read the same data.
- Network scenarios are applied before each handler runs. They are selected in Options or with
  `?scenario=`, persisted, and reset with *Reset mock data* (full list in the README).
- `register-timeout` stores the match, then never answers the first request for it, so the client
  times out and recovers through a retry that receives `created: false`.
- Latency uses a seeded PRNG (`?mockSeed=`), and `?mockLatency=` replaces it with a fixed value.

## 9. Test instrumentation

The Playwright suite needs to observe the match and control time without replacing the game.

- **`?test`** installs `window.__PIRATE_BATTLE__` (`src/game/testHooks.ts`) with `getWorld()` and
  `countDisplayObjects()`. Without the flag, nothing is exposed. The hook is removed when the engine
  is destroyed.
- **`?test&clock=manual`** stops the ticker before the first frame. `advance(seconds)` then runs the
  same `runFrame` as the real loop at a fixed 60 frames per second and draws once. Input, rules,
  collisions, events and rendering all run for real; only the source of time changes.
- Combat tests press the real keys (or the touch controls) and then read the world to check the
  effects. They never write to the simulation.
- Pause and focus tests use the real-time clock, because the point is to show that real time passing
  does not move the match.
- Every test runs in a fresh browser context with a fixed match seed and instant mock answers, so
  runs are isolated and reproducible.

## 10. Balancing decisions

All values are in `DEFAULT_CONFIG` (`src/game/config.ts`).

- **Player:** 100 HP, 210 px/s, faster than every enemy (Chaser 165, Shooter 110), so outrunning
  them is a real option. The front cannon is a heavy shot: 30 damage every 0.4 s, range ≈ 624 px. One
  hit sinks a Chaser, two sink a Shooter. Broadsides fire 3 × 15 damage every 1.5 s (range ≈ 414 px)
  and reward positioning.
- **Chaser:** 30 HP, 20 contact damage. It punishes standing still, but a moving player can outrun it.
- **Shooter:** 50 HP, slow, fires 8 damage every 2 s from up to 420 px and holds at 300 px. It forces
  the player to close the distance.
- **Spawning:** every 3 s after a 2 s delay, with the pattern Chaser, Shooter, Chaser, never closer
  than 450 px, at most 10 alive. Every fourth spawn is a pair, which breaks the steady rhythm with two
  threats at once. A default 60 s match spawns up to 25 enemies (20 spawns, 5 of them pairs).
- **Options limits:** session time 60–180 s (whole seconds); spawn interval 0.5–10 s
  (`OPTION_LIMITS` in `src/settings/options.ts`). Below 0.5 s the arena fills to the cap at once;
  above 10 s matches feel empty.
- **Tuning history.** With the first enemy tuning (25 contact damage, Shooter 10 damage every 1.8 s),
  a bot spinning in place and firing blindly sank in about 13 s, which felt too punishing, so those
  values were lowered. Later the player became faster (180 → 210 px/s) and the front cannon heavier
  (20 → 30 damage). Then pair spawns were added: with the aiming bot below, the run went from 19 of
  20 enemies with 68–84 HP left to the numbers below, so the match got harder but stays winnable.
- **Current playtest** (headless, default options, seeds 1–5, 60 steps/s): a bot that only turns to
  the nearest enemy and fires the front cannon always survives the 60 s, sinks 23 of the 25 enemies
  and keeps 60–68 HP. A bot spinning in place and firing every weapon blindly sinks after 18–28 s with
  3–8 points. Aiming pays off, and survival is not automatic.

## 11. Known limitations

**Gameplay**

- Ships use a single collision circle, so the bow and stern of the long hull can overlap things
  slightly.
- Island avoidance is a simple probe and can look indecisive in tight gaps between islands.

**Ranking and history**

- The Ranking tab shows matches played with the current Options; other configs are not browsable.
- The player id and the mock database live in the browser's localStorage: clearing it creates a new
  player, and different devices do not see each other's matches.
- The MSW mock ships in the production build (the challenge requires it) and keeps a little memory per
  intercepted request (see [PERFORMANCE.md](PERFORMANCE.md#memory-investigation)).

**Tests and performance**

- Visual baselines are recorded on Linux; other platforms need their own (see the README).
- Headless Chromium renders WebGL on the CPU in the E2E suite, so the suite checks behavior, not
  frame rate. Frame rate is measured separately, on the GPU, by `npm run perf`.
- Phones and HiDPI screens were not profiled; the renderer resolution is capped at 2× to limit the
  cost there.
- PixiJS is part of the main bundle (≈ 615 kB minified); it could be loaded only when a match starts.
