import { describe, it, expect, vi } from 'vitest'
import { withBusyRetry } from '@/lib/db'
import { ApiError } from '@/lib/apiHandler'

function busyError() {
  return new Error('SQLITE_BUSY: database is locked')
}

describe('withBusyRetry', () => {
  it('returns the result on the first try when there is no contention', async () => {
    const run = vi.fn().mockResolvedValue('ok')
    await expect(withBusyRetry('test.op', run)).resolves.toBe('ok')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('retries once on a busy error and succeeds if the lock clears', async () => {
    const run = vi.fn().mockRejectedValueOnce(busyError()).mockResolvedValueOnce('ok')
    await expect(withBusyRetry('test.op', run)).resolves.toBe('ok')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('gives up after exhausting retries and throws a clean 503 ApiError', async () => {
    const run = vi.fn().mockRejectedValue(busyError())
    const result = withBusyRetry('test.op', run)
    await expect(result).rejects.toBeInstanceOf(ApiError)
    await expect(result).rejects.toMatchObject({ status: 503 })
    // RETRY_ATTEMPTS is 2 (1 initial try + 1 retry) — never more calls than that.
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('does not retry a non-busy error — propagates immediately', async () => {
    const run = vi.fn().mockRejectedValue(new Error('Unique constraint failed'))
    await expect(withBusyRetry('test.op', run)).rejects.toThrow('Unique constraint failed')
    expect(run).toHaveBeenCalledTimes(1)
  })
})
