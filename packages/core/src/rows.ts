// Row helpers shared by every client.

import { getTableColumns, type Table } from 'drizzle-orm'

/**
 * A settings row with every field filled: the stored row if there is one,
 * else the schema's own defaults. Single-row settings tables may simply not
 * have their row yet (a new household, or settings never touched), and the
 * defaults live in one place — the column definitions in schema.ts.
 */
export function withDefaults<T extends Table>(table: T, id: string, row: T['$inferSelect'] | undefined | null): T['$inferSelect'] {
  if (row) return row
  const out: Record<string, unknown> = { id, deletedAt: null }
  for (const [key, col] of Object.entries(getTableColumns(table))) {
    if (key === 'id' || key === 'deletedAt') continue
    out[key] = col.hasDefault ? col.default : null
  }
  return out as T['$inferSelect']
}
