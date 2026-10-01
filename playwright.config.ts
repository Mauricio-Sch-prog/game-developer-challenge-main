import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

/**
 * E2E suite against the production build (`vite preview`), the same bundle
 * that is deployed. Every test runs in a fresh browser context, so storage,
 * the mock database and the MSW service worker start from scratch.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  expect: {
    // WebGL is software-rendered in headless Chromium: starting a match can take
    // a few seconds while other workers run in parallel.
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /touch\.spec\.ts/,
    },
    {
      // The main flows, touch controls and screenshots again on a phone held in landscape.
      name: 'mobile',
      use: { ...devices['Pixel 7 landscape'] },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
