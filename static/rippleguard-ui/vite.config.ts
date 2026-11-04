import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Must match `resources[].tunnel.port` in ../../manifest.yml
const DEV_PORT = 5173

// https://vite.dev/config/
export default defineConfig({
  // Forge serves Custom UI from a nested path, so asset URLs must be relative.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../src/shared', import.meta.url)),
    },
  },
  server: {
    port: DEV_PORT,
    strictPort: true,
    fs: {
      // Allow importing the backend/frontend shared contracts.
      allow: ['.', '../../src/shared'],
    },
  },
  build: {
    // Must match `resources[].path` in ../../manifest.yml
    outDir: 'build',
    emptyOutDir: true,
  },
})
