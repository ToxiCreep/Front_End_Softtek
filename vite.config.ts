import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { proxy: { '/api': { target: `http://127.0.0.1:${process.env.SOFTY_PORT || loadEnv('development', process.cwd(), 'SOFTY_').SOFTY_PORT || 3001}`, timeout: 300_000, proxyTimeout: 300_000 } } },
})
