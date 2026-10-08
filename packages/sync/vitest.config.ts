import { defineConfig } from 'vitest/config'

// The sync protocol, tested in Node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
