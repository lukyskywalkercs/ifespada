import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'maplibre-worker': ['maplibre-gl/dist/maplibre-gl-worker.mjs'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/firms': {
        target: 'https://firms.modaps.eosdis.nasa.gov',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/firms/, '/data/active_fire'),
      },
    },
  },
})
