import { defineConfig, type Plugin } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Enforce the "nothing leaves the browser" promise in production builds:
// the CSP forbids every network connection (connect-src 'none') and
// every non-self script. (Skipped in dev so Vite's HMR socket still works.)
const csp = (): Plugin => ({
  name: 'cleansheet-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content:
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'",
      },
      injectTo: 'head-prepend',
    },
  ],
})

export default defineConfig({
  base: './',
  plugins: [vue(), tailwindcss(), csp()],
  build: { target: 'es2020', chunkSizeWarningLimit: 700 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
