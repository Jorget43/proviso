import { defineConfig } from 'vitest/config'
import path from 'node:path'

// `@/*` maps to the project root (see tsconfig / CLAUDE.md), so mirror it here
// for the engine tests. Node environment — these are pure-function unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
