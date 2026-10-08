import { defineConfig } from 'vitest/config'

// The relay against a real SQLite file and a real HTTP server.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
