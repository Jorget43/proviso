import { describe, it, expect } from 'vitest'
import { runProjections } from '@/lib/projections'
import { makeProjectionInputs } from './fixtures/projections'

// The engine's starting point covers everything on the Own & owe lists
// (lib/netWorth.ts), so the projected line starts where Home's figure is.
describe('projection starts from the full net worth', () => {
  const plain = runProjections(makeProjectionInputs()).base

  it('existing investments start the investment balance and grow at the return rate', () => {
    const r = runProjections(makeProjectionInputs({ investmentsValue: 40_000 })).base
    const ret = makeProjectionInputs().investReturn / 100
    // Year 1: the existing 40k grows once; the surplus invested is unchanged.
    expect(r.investArr[0] - plain.investArr[0]).toBeCloseTo(40_000 * (1 + ret), 0)
    expect(r.nwArr[0] - plain.nwArr[0]).toBeCloseTo(40_000 * (1 + ret), 0)
    // Compounds every year after.
    const last = r.investArr.length - 1
    expect(r.investArr[last] - plain.investArr[last]).toBeCloseTo(40_000 * Math.pow(1 + ret, last + 1), -1)
  })

  it('other debts reduce net worth by the same amount every year (held flat)', () => {
    const r = runProjections(makeProjectionInputs({ otherDebts: 12_000 })).base
    r.nwArr.forEach((v, i) => expect(plain.nwArr[i] - v).toBe(12_000))
  })

  it('missing values default to zero (older callers unchanged)', () => {
    const r = runProjections(makeProjectionInputs({ investmentsValue: undefined, otherDebts: undefined })).base
    expect(r.nwArr).toEqual(plain.nwArr)
  })
})
