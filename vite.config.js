import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { securityHeaders } from './scripts/security-headers.mjs'

export default defineConfig({
  plugins: [react()],
  base: '/',
  preview: { headers: securityHeaders },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-vendor'
          if (id.includes('node_modules/lucide-react/')) return 'ui-icons'
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.js'],
  },
})
