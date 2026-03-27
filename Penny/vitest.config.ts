import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'src/renderer/src/types.ts'),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'main',
          environment: 'node',
          include: ['tests/main/**/*.test.ts', 'src/mcp/**/*.test.ts'],
          setupFiles: ['tests/setup/main.setup.ts'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
      {
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['tests/renderer/**/*.test.ts', 'src/renderer/**/*.test.ts'],
          setupFiles: ['tests/setup/renderer.setup.ts'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
    ],
  },
})
