// When to sync: soon after a change, every half minute, and when the app
// comes back to the foreground; one sync at a time. Plain TypeScript so the
// React provider only subscribes to it.

import type { Db } from './db'
import { syncState, type SyncState } from './sync'
import { runSync } from './syncRunner'

export const SYNC_EVERY_MS = 30_000
export const SEND_AFTER_MS = 1_500

export interface SyncStatus { state: SyncState | null; busy: boolean; error: string | null }

export class SyncScheduler {
  private status: SyncStatus = { state: null, busy: false, error: null }
  private inFlight: Promise<void> | null = null
  private sendTimer: ReturnType<typeof setTimeout> | null = null
  private every: ReturnType<typeof setInterval> | null = null

  constructor(
    private db: Db,
    private onStatus: (s: SyncStatus) => void,
    /** Called when other devices' changes arrived, so screens reload. */
    private onReceived: () => Promise<void>,
  ) {}

  private set(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.onStatus(this.status)
  }

  async refresh(): Promise<void> {
    this.set({ state: await syncState(this.db) })
  }

  start(): void {
    this.every = setInterval(() => { void this.run({ quiet: true }) }, SYNC_EVERY_MS)
    void this.refresh().then(() => this.run({ quiet: true }))
  }

  stop(): void {
    if (this.every) clearInterval(this.every)
    if (this.sendTimer) clearTimeout(this.sendTimer)
  }

  /** After a local change: send it shortly (several quick edits go together). */
  changed(): void {
    if (!this.status.state) return
    if (this.sendTimer) clearTimeout(this.sendTimer)
    this.sendTimer = setTimeout(() => { void this.run({ quiet: true }) }, SEND_AFTER_MS)
  }

  /** Syncs now; a request while one runs waits for that one. Quiet runs record errors instead of throwing. */
  run(opts: { quiet?: boolean } = {}): Promise<void> {
    if (this.inFlight) return this.inFlight
    this.inFlight = (async () => {
      this.set({ busy: true })
      try {
        const r = await runSync(this.db)
        if (r && r.received > 0) await this.onReceived()
        this.set({ error: null })
      } catch (e) {
        this.set({ error: e instanceof Error ? e.message : String(e) })
        if (!opts.quiet) throw e
      } finally {
        this.set({ busy: false })
        await this.refresh()
        this.inFlight = null
      }
    })()
    return this.inFlight
  }
}
