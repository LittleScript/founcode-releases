import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  // Main/preload keep runtime deps (electron-updater, nanoid) external so
  // electron-builder packages them from node_modules; renderer deps are
  // fully bundled by vite and live in devDependencies.
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    plugins: [react(), tailwindcss()],
  },
})
