import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fixed port so the preview/launch config is stable and avoids clashing with
// the other Vite projects on this machine.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5180,
    strictPort: false,
    proxy: {
      '/api': 'http://localhost:4100',
    },
  },
})
