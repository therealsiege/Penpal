import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/renderer/src/types.ts'),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/out/**', 'tests/*.spec.ts', 'src/main/evals/__tests__/**'],
    environmentMatchGlobs: [
      ['tests/renderer/**', 'jsdom'],
      ['src/renderer/**', 'jsdom'],
    ],
  },
})
