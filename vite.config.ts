import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  optimizeDeps: {
    exclude: ['maplibre-gl'],
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
      // Redirigir peticiones del worker de MapLibre al archivo correcto
      '/assets/maplibre-gl-worker.mjs': {
        target: 'http://localhost:5173',
        rewrite: () => '/assets/maplibre-gl-worker.js',
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/assets/maplibre-gl-worker.mjs': {
        target: 'http://localhost:4173',
        rewrite: () => '/assets/maplibre-gl-worker.js',
      },
    },
  },
})
