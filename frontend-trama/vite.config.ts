import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const proxy = {
  '/api/push-notifications': { target: 'http://localhost:3001', changeOrigin: true },
  '/api': { target: 'http://localhost:8080', changeOrigin: true },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy,
  },
  preview: {
    port: 4180,
    strictPort: true,
    proxy,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    maxWorkers: 2,
  },
})
