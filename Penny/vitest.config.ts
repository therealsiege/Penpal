import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
          // These suites use node:test (run via tsx --test); Vitest would load them with 0 suites.
          exclude: [
            'src/main/evals/__tests__/context-usage.test.ts',
            'src/main/evals/__tests__/harness.test.ts',
            'src/main/evals/__tests__/human-judge.test.ts',
            'src/main/evals/__tests__/pod-quality.test.ts',
            'src/main/evals/__tests__/task-outcomes.test.ts',
          ],
          include: [
            'tests/main/**/*.test.ts',
            'src/main/pods.test.ts',
            'src/main/pods-workflow-review.test.ts',
            'src/main/pods-self-fix-workflow.test.ts',
            'src/main/pods/__tests__/**/*.test.ts',
            'src/main/context-response.test.ts',
            'src/main/evals/reports/__tests__/**/*.test.ts',
            'src/main/evals/__tests__/**/*.test.ts',
            'tests/main/evals/**/*.test.ts',
            'src/mcp/**/*.test.ts',
          ],
          setupFiles: ['tests/setup/main.setup.ts'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
      {
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: [
            'tests/renderer/**/*.test.ts',
            'tests/renderer/**/*.test.tsx',
            'src/renderer/**/*.test.ts',
            'src/renderer/**/*.test.tsx',
          ],
          setupFiles: ['tests/setup/renderer.setup.ts'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
    ],
  },
})
