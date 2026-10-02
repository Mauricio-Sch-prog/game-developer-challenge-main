# Performance

Profiling evidence for the combat: frame rate, 95th percentile frame time and entity counts over a
three-minute match, and memory after five cycles of starting, playing and leaving a match, with an
investigation of the growth that remained.

**Target:** 60 FPS on the reference environment below, with the optimized production build.
**Result:** met. 60 FPS for the whole match at the heaviest load the rules allow, with no frame
over budget.

## Summary

| | Reference (GPU) | No GPU (software WebGL) |
| --- | --- | --- |
| Average frame rate | **60.0 FPS** | 11.0 FPS |
| Frame time p95 | **16.7 ms** | 100.1 ms |
| Frame time p99 / max | 16.8 ms / 16.8 ms | 100.1 ms / 133.3 ms |
| Frames slower than 17 ms | 0 of 10,795 | 1,973 of 1,973 |
| Lowest 1-second frame rate | 60 FPS | 10 FPS |
| Main-thread time per frame | 0.88 ms (0.54 ms in scripts) | 91.4 ms (0.87 ms in scripts) |
| Enemies alive (average / peak) | 9.5 / 10 | 9.4 / 10 |
| Projectiles (average / peak) | 3.9 / 9 | 3.2 / 9 |
| Pixi display objects (average / peak) | 234 / 245 | 233 / 240 |

| Memory, five cycles (reference) | |
| --- | --- |
| JS heap after GC, cycle 1 → cycle 5 | 7.36 MB → 8.13 MB (+0.77 MB) |
| DOM nodes, event listeners, canvases left | constant: 99, 210–217, 0 |
| Game objects retained between matches | none (heap snapshot diff) |
| Leak found and fixed | audio loops left paused were never released (2 instances per match) |

## Reference environment

| | |
| --- | --- |
| Machine | Laptop, Intel Core i5-10210U (4 cores, 8 threads, 1.6–4.2 GHz), 7.1 GiB RAM, plugged in (AC) |
| GPU | Intel UHD Graphics (Comet Lake GT2), Mesa driver. The laptop also has an NVIDIA GeForce MX250, which Chromium did not use. |
| OS | Ubuntu 26.04 LTS |
| Browser | Chromium 153.0.8010.12, headless (Playwright 1.63), launched with `--enable-gpu --use-angle=gl`. WebGL renderer: `ANGLE (Intel, Mesa Intel(R) UHD Graphics (CML GT2), OpenGL ES 3.2)` |
| Resolution | 1366 × 768 viewport, device pixel ratio 1 (the laptop's screen) |
| Build | Production bundle (`vite build`, served by `vite preview`) |
| Date | 2026-10-01 |

The "No GPU" column is the same machine and browser without the GPU flags: WebGL is rendered on the
CPU by SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`). That is what a
CI runner or a machine without a usable GPU gets.

## Benchmark match

- **Options at their extremes:** session time 180 s and spawn interval 0.5 s, both inside the limits
  of the Options screen. Every other value is `DEFAULT_CONFIG`: at most 10 enemies alive, and every
  fourth spawn is a pair. Seed 2.
- **The heaviest load the rules allow:** the arena reaches the 10-enemy cap 7 s into the match and
  stays there until the end. Chasers keep ramming and exploding, and Shooters keep firing.
- **Player:** a keyboard bot running in the page. It turns to the nearest enemy with A/D, holds
  Space when aimed, and fires a broadside (Q/E) when an enemy is abeam within 380 px. Its keys go
  through the game's own keyboard listeners. On the reference run it sank 188 of the 225 enemies
  spawned.
- **Benchmark-only change:** at this spawn rate any player sinks within a minute, which would end
  the match and the load. The benchmark therefore restores the player's HP through the test hook
  whenever it drops below 60. Spawns, AI, collisions, projectiles, effects, audio and rendering run
  unchanged, in real time.

## How it is measured

`npm run perf` runs [perf/performance.spec.ts](perf/performance.spec.ts) with
[playwright.perf.config.ts](playwright.perf.config.ts): production build, real-time clock, one test
at a time so runs never compete for the CPU or the GPU.

- **Frame intervals:** a `requestAnimationFrame` callback in the page, next to the Pixi ticker,
  records the time between every two consecutive frames.
- **Entities:** one sample per second. Enemies and projectiles come from the simulation; display
  objects are counted in the Pixi scene graph (`countDisplayObjects` test hook), so sprites, health
  bars, pooled cannonballs and visual effects are all included.
- **Main-thread time:** Chrome DevTools Protocol `Performance.getMetrics` (`TaskDuration`,
  `ScriptDuration`) read before and after the match, divided by the number of frames.
- **Memory:** five cycles of Play → 30 s of bot play (same benchmark options) → Esc → Main Menu.
  After each cycle, garbage collection is forced twice (`HeapProfiler.collectGarbage`), then the JS
  heap, DOM nodes, JS event listeners and canvases are read.
- **Investigation:** [perf/memory-investigation.mjs](perf/memory-investigation.mjs) runs longer
  series and compares heap snapshots (see [Memory investigation](#memory-investigation)).
- **Raw results**, with the environment and every per-second sample:
  [gpu-combat.json](perf/results/gpu-combat.json),
  [software-combat.json](perf/results/software-combat.json),
  [gpu-memory.json](perf/results/gpu-memory.json) and the
  [investigation logs](perf/results/memory-investigation/).

## Results

### Combat on the reference environment

| Frame interval | Frames |
| --- | ---: |
| ≤ 17 ms (one 60 Hz frame) | 10,795 |
| 17–20 ms | 0 |
| 20–33 ms | 0 |
| 33–50 ms | 0 |
| > 50 ms | 0 |

| Match time | Enemies | Projectiles | Display objects | FPS in that second |
| ---: | ---: | ---: | ---: | ---: |
| 1 s | 0 | 0 | 162 | 60 |
| 10 s | 8 | 5 | 223 | 60 |
| 30 s | 9 | 3 | 232 | 60 |
| 60 s | 10 | 1 | 239 | 60 |
| 90 s | 10 | 3 | 239 | 60 |
| 120 s | 10 | 6 | 237 | 60 |
| 150 s | 9 | 0 | 231 | 60 |
| 179 s | 10 | 2 | 237 | 60 |

### Combat without a GPU

| Match time | Enemies | Projectiles | Display objects | FPS in that second |
| ---: | ---: | ---: | ---: | ---: |
| 1 s | 0 | 0 | 162 | 16 |
| 10 s | 8 | 5 | 224 | 11 |
| 30 s | 10 | 7 | 234 | 11 |
| 60 s | 10 | 2 | 234 | 11 |
| 120 s | 10 | 5 | 233 | 10 |
| 180 s | 8 | 1 | 227 | 11 |

- Almost every frame took about 100 ms: 1,970 of the 1,973 frames were longer than 50 ms.
- The game's scripts still took only 0.87 ms per frame. The other ~90 ms of main-thread time per
  frame is rendering work done on the CPU.
- The match still ran in real time (180 s of match in 180 s), because a frame may simulate up to
  0.25 s split into short steps. The rules and collisions stay correct, but at 11 FPS the game is not
  pleasant to play.
- A first run in this setup did not reach the end of the match within its 210 s measurement window,
  so the simulation fell behind real time at some point. That happens when frames take more than
  0.25 s. Without a GPU, the result also varies from run to run.

### Memory after five cycles

| After | JS heap (after GC) | DOM nodes | Event listeners | Canvases | Peak display objects in the cycle |
| --- | ---: | ---: | ---: | ---: | ---: |
| Menu, before any match | 4.05 MB | 95 | 176 | 0 | — |
| Cycle 1 | 7.36 MB | 99 | 211 | 0 | 240 |
| Cycle 2 | 7.62 MB | 99 | 217 | 0 | 241 |
| Cycle 3 | 7.84 MB | 99 | 210 | 0 | 238 |
| Cycle 4 | 7.99 MB | 99 | 213 | 0 | 242 |
| Cycle 5 | 8.13 MB | 99 | 213 | 0 | 236 |

- **The first match** adds ~3.3 MB that stays for the whole session, as intended: the textures in
  the Pixi Assets cache, the sound library, and the code compiled on first use.
- **Between matches:** DOM nodes stay at 99 and listeners fluctuate between 210 and 217 without a
  trend. No canvas is left behind, the test hook is removed, and no WebGL context warning was logged.
- **The heap still grew 0.77 MB from cycle 1 to cycle 5**, so this was investigated.

### Memory investigation

[perf/memory-investigation.mjs](perf/memory-investigation.mjs) repeats the cycle many times and
compares heap snapshots between two cycles, grouped by constructor. It runs on an unminified build so
the class names are real, and it traces suspended async functions back to the script that created
them.

**1. Two phases.** Over 25 cycles of 5 s, the heap grows ~0.15 MB per cycle for the first 9 cycles,
then settles at ~0.04 MB per cycle. The first phase is the JS engine warming up: most of it is
compiled code (`(code)` in the snapshots).

**2. A leak in the game, now fixed.** Comparing cycle 10 with cycle 25 showed 2 `WebAudioInstance`
objects (and their event listeners) kept per match. Every match has two looping sounds (ocean and
sailing), and the cycles leave through the pause menu:
- pausing the game paused those loops;
- @pixi/sound only releases an instance (back to its pool) when `stop()` is called on one that is
  playing, so a paused loop stayed referenced by its `Sound` forever.

`GameAudio` now stops the loops on pause instead of pausing them, and starts them again on resume.
After the fix, `WebAudioInstance` no longer grows
([before](perf/results/memory-investigation/1-before-audio-fix.txt),
[after](perf/results/memory-investigation/2-after-audio-fix.txt)).

**3. What remains comes from outside the game code** (cycle 10 → 25, after the fix):

| Source | Growth per cycle | Evidence |
| --- | --- | --- |
| MSW browser client (the mock API) | ~15 suspended async functions per match, with the request data they hold: natives, strings, buffers. About 0.02 MB. | Every suspended function is traced to the `msw/browser` chunk. With service workers blocked, they disappear and the steady growth halves, from 0.04 to 0.019 MB per cycle ([log](perf/results/memory-investigation/3-after-audio-fix-without-msw.txt)). |
| JS engine compiled code | ~10 kB | `(code)` also grows in a control run that opens Options instead of playing. |
| Pixi texture bind-group cache | 1 entry (~20 bytes) | `getTextureBatchBindGroup` keeps a module-level cache that is never cleared. |

No game object grows between matches: no `GameEngine`, `World`, `ShipView`, `Sprite`, `Texture` or
`Application`. Every match's engine, scene graph and listeners are released when it is left.

## Analysis

- **Frame budget.** At 60 Hz a frame has 16.7 ms. On the reference environment the main thread used
  0.88 ms per frame, about 5% of the budget, for the simulation, the views, React and Pixi's render
  commands. No frame missed the budget during the three minutes, so the GPU side kept up as well.
- **Why the load stays small.** The display-object count explains it:
  - 162 objects exist before any enemy appears: the static arena (a single `TilingSprite` for the
    water plus 148 island and shallow-water tiles), the player's ship and the layer containers.
  - Each enemy adds 6: ship container, hull, fire, and a health bar of 3.
  - The rest are pooled cannonball sprites and short-lived effects.

  The rules cap the dynamic part: at most 10 enemies, projectiles that live about 1 s, effects that
  last under 2 s. At the peak (245 objects) the dynamic part is about 80 objects.
- **Choices that keep it cheap:**
  - the static arena is built once and never touched per frame;
  - cannonball sprites are pooled;
  - one shared `GraphicsContext` serves every splash ring;
  - the cropped health-bar texture is only rebuilt when the HP changes;
  - React renders about once per second (the HUD store only notifies on change), never per frame.
- **Without a GPU the bottleneck is rasterization, not the game logic.** It would need a lighter
  rendering path (no antialiasing, lower resolution), which was not a goal.

## Limitations observed

- **Headless frame pacing.** Headless Chromium paces frames with a virtual 60 Hz display, which is
  why the intervals are so regular (16.7 ± 0.1 ms). A frame that misses its deadline still shows up
  as a ≥ 33 ms interval, and none did on the reference environment. The run does not include a real
  screen's compositor and vsync, and it does not measure GPU time per frame or input latency.
- **One run per setup**, on a developer laptop with other applications open (the code editor), not
  on an isolated machine. The software-rendering numbers varied between runs (see above).
- **Benchmark HP restore** (see above): needed to keep three minutes at the enemy cap. The player's
  ship never reaches its most damaged look, so its burning sprite is rarely drawn.
- **Resolution.** Measured at device pixel ratio 1. On HiDPI screens the renderer resolution goes up
  to 2× (capped in `GameEngine`), which means up to 4× the pixels to fill. Phones were not profiled.
- **Audio** runs during the benchmark (Web Audio decoding and mixing), but headless Chromium mutes
  the output.
- **The MSW mock grows the heap slightly with every request it intercepts** (see the investigation).
  It ships in the deployed build because the challenge requires the mocked API there; a real API
  would not have it.
- **Loading** is outside these numbers: the main JavaScript chunk is about 615 kB minified because
  PixiJS is in it. It could be loaded only when a match starts.

## Reproducing

```bash
npm run perf                            # both setups, about 10 minutes
npm run perf -- --project gpu           # reference (GPU) only
PERF_SESSION_SECONDS=60 npm run perf    # a shorter match while tuning

# Memory investigation, against a running build (see the header of the script for options)
npm run build && npm run preview        # in another terminal
CYCLES=25 PLAY_MS=5000 SNAP_FROM=10 node perf/memory-investigation.mjs
```

The GPU flags are in [playwright.perf.config.ts](playwright.perf.config.ts). Check `environment.webgl`
in the result files to confirm which renderer a run used: a `SwiftShader` renderer means the GPU was
not available.
