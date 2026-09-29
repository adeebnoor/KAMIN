import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { securityHeaders } from './scripts/security-headers.mjs'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  worker: { format: 'es' },
  // This product explicitly uses WASM. Avoid bundling unused WebGPU kernels.
  resolve:{alias:{'onnxruntime-web/webgpu':path.resolve('node_modules/onnxruntime-web/dist/ort.wasm.min.mjs')}},
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
