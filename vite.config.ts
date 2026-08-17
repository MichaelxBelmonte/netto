import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // The national MEF register is intentionally shipped client-side for private, instant search.
    chunkSizeWarningLimit: 1100,
  },
})
