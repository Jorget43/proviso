// The web build pastes the join code instead of scanning it.

export const canScan = false

export function Scanner(_: { onCode: (code: string) => void }) {
  return null
}
