// Shared by lib/db.ts (the retry extension) and lib/apiHandler.ts (the
// toErrorResponse backstop) — kept in its own file so neither has to import
// the other just for this one check.
export function isBusyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /database is locked|SQLITE_BUSY/i.test(msg)
}
