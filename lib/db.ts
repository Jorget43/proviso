import { PrismaClient } from '@prisma/client'
import { ApiError } from './apiHandler'
import { isBusyError } from './dbErrors'

// Force Prisma's own internal SQLite pool down to exactly one physical
// connection. Without this, Prisma can open several concurrent handles to
// the same file and have them contend with each other for the SQLite file
// lock — a self-inflicted SQLITE_BUSY source, independent of any real
// external contention. Appended here (not .env) so the Docker image's baked
// -in DATABASE_URL doesn't need to change.
function withSingleConnection(url: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}connection_limit=1`
}

// SQLite's own busy_timeout is itself an internal wait-and-retry — a single
// query that hits contention can block up to this long before SQLite even
// returns SQLITE_BUSY to Prisma. Stacking a long timeout with many JS-level
// retries compounds fast (naively, N attempts x this value), so keep both
// small: one retry on top of one busy_timeout wait bounds the worst case at
// roughly 2x this value, which is long enough to ride out a brief lock and
// short enough not to hang a request.
const BUSY_TIMEOUT_MS = 3000
const RETRY_ATTEMPTS = 2 // 1 initial try + 1 retry
const RETRY_DELAY_MS = 200

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Exported so it's independently unit-testable with a mock `run` — no live DB
// or real lock contention needed to verify the retry/backoff/give-up logic.
export async function withBusyRetry<T>(operation: string, run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (err) {
      if (!isBusyError(err)) throw err
      if (attempt >= RETRY_ATTEMPTS) {
        throw new ApiError(503, 'Database is busy, please try again')
      }
      console.warn(`[db] ${operation} hit SQLITE_BUSY, retrying...`)
      await sleep(RETRY_DELAY_MS + Math.random() * RETRY_DELAY_MS)
    }
  }
}

function createPrismaClient() {
  const client = new PrismaClient({
    datasources: {
      db: { url: withSingleConnection(process.env.DATABASE_URL ?? 'file:./household.db') },
    },
  })

  // busy_timeout is per-connection state, not persisted in the DB file, so it
  // must be set on every live connection. Fire-and-forget is safe here:
  // connection_limit=1 guarantees exactly one physical connection, and
  // Prisma serializes statements on it in submission order, so this always
  // lands before any later application query.
  //
  // Must be $queryRawUnsafe, not $executeRawUnsafe: `PRAGMA busy_timeout = N`
  // returns the new value as a result row, and Prisma's SQLite connector
  // rejects `execute()`-style calls that return rows (P2010 "Execute
  // returned results, which is not allowed in SQLite") — confirmed against
  // a real local DB while verifying this change.
  client.$queryRawUnsafe(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`).catch((err) => {
    console.error('[db] failed to set busy_timeout pragma:', err)
  })

  return client.$extends({
    name: 'retry-on-busy',
    query: {
      $allOperations: ({ operation, args, query }) => withBusyRetry(operation, () => query(args)),
    },
  })
}

type PrismaClientExtended = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientExtended }
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
