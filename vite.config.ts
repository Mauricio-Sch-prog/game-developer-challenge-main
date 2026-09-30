import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Serve the provided asset pack as-is (e.g. /png/default/ships/ship_1.png)
  // so it is not duplicated into a separate public/ folder.
  publicDir: 'assets',
})
