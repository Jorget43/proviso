// The database handle every loader and write takes. On devices it's Drizzle
// over expo-sqlite (src/data/open.ts); in tests it's Drizzle's proxy driver
// over node:sqlite. Code in src/data must work with both: always `await`
// queries. Only open.ts (expo-sqlite) and DataProvider.tsx (React) may import
// platform code; everything else here is plain TypeScript, tested in Node.

import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = BaseSQLiteDatabase<'sync' | 'async', any>
