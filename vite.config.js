import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  build: {
    modulePreload: false,
  },
  plugins: [
    react(),
    crx({ manifest }),
  ],
})
