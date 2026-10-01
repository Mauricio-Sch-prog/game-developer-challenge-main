import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { queryClient } from './api/queryClient'
import { initAudio } from './audio/sounds'
import { startMockApi } from './mocks/browser'

initAudio()

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

// Start the mock API first so the very first requests are intercepted.
// If it cannot start, the game still opens; only ranking/history will fail.
startMockApi()
  .catch((error: unknown) => console.warn('Mock API unavailable; ranking and history will not load.', error))
  .finally(render)
