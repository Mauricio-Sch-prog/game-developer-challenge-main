import { defineConfig } from '@playwright/test'

const PORT = 4173

/**
 * Performance profiling (`npm run perf`), separate from the E2E suite:
 * production build, real-time clock, and one test at a time so runs never
 * compete for the CPU or the GPU. Results are written to perf/results/.
 */
export default defineConfig({
  testDir: './perf',
  workers: 1,
  fullyParallel: false,
  timeout: 15 * 60_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    // The reference laptop's screen.
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  },
  projects: [
    {
      // Reference setup: headless Chromium on the real GPU (ANGLE over OpenGL).
      name: 'gpu',
      use: { launchOptions: { args: ['--enable-gpu', '--use-angle=gl'] } },
    },
    {
      // Worst case: no GPU, WebGL rendered on the CPU (SwiftShader), like a CI machine.
      name: 'software',
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
