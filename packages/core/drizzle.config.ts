import { defineConfig } from 'drizzle-kit'

// Migrations for the local-first schema (src/schema.ts). Generated with
// `npm run db:generate -w @proviso/core`; every app bundles the SQL in
// ./drizzle and applies it at start-up. Never edit a generated migration.
export default defineConfig({
  dialect: 'sqlite',
  schema:  './src/schema.ts',
  out:     './drizzle',
})
