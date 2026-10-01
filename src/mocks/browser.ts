/**
 * Starts the MSW service worker. It runs in every build (dev, tests and the
 * published demo), because the ranking/history API only exists as a mock.
 * Loaded lazily so the app can still start if service workers are unavailable.
 */
export async function startMockApi(): Promise<void> {
  const [{ setupWorker }, { handlers }] = await Promise.all([import('msw/browser'), import('./handlers')])
  const worker = setupWorker(...handlers)
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    // Textures, sounds and scripts go to the network untouched.
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
}
