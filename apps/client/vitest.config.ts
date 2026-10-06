import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Tests for the client's data layer (src/data): plain TypeScript, run in Node
// against node:sqlite through Drizzle's proxy driver. Screens aren't tested here.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
