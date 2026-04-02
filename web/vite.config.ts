import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/castsense/',
  plugins: [react()],
  optimizeDeps: {
    // @langchain/openai must be pre-bundled for Vite dev server to resolve
    // it when initChatModel-style code uses dynamic bare-specifier imports internally.
    include: ['@langchain/openai'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
