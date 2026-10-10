import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 5174, strictPort: true, proxy: {
    '/api': { target: process.env.BACKEND_URL || 'http://127.0.0.1:3002', changeOrigin: true }
  } },
  build: { outDir: 'demo-dist' }
});
