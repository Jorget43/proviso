import { defineConfig } from 'vitest/config'

// Pure-function unit tests for the calculations and schemas.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
