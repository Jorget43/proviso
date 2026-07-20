import { describe, it, expect } from 'vitest'
import {
  calcIncomeTax,
  calcLITO,
  calcMedicare,
  calcHELPRepayment,
  calcAfterTax,
  marginalRate,
  effectiveRate,
} from '@/lib/tax'

// These pin the ATO 2024-25 Stage 3 outputs. When the brackets are updated for a
// new financial year, these expected values must be recomputed deliberately —
// that is the point: an accidental change to the money math fails the suite.

describe('calcIncomeTax (Stage 3 2024-25)', () => {
  it('is zero at/below the tax-free threshold', () => {
    expect(calcIncomeTax(0)).toBe(0)
    expect(calcIncomeTax(18200)).toBe(0)
    expect(calcIncomeTax(-5000)).toBe(0)
  })

  it('applies the 16% bracket net of LITO at low income', () => {
    // (30000-18200)*0.16 = 1888; LITO at 30k = 700; → 1188
    expect(calcIncomeTax(30000)).toBeCloseTo(1188, 6)
  })

  it('matches a $120k salary', () => {
    // 26800*0.16 + 75000*0.30 = 4288 + 22500 = 26788; LITO 0
    expect(calcIncomeTax(120000)).toBeCloseTo(26788, 6)
  })

  it('matches a $200k salary across all brackets', () => {
    // 4288 + 90000*0.30 + 55000*0.37 + 10000*0.45 = 4288+27000+20350+4500
    expect(calcIncomeTax(200000)).toBeCloseTo(56138, 6)
  })
})

describe('calcLITO', () => {
  it('is the full $700 up to $37,500', () => {
    expect(calcLITO(37500)).toBe(700)
  })
  it('tapers at 5c in the first phase-out band', () => {
    expect(calcLITO(40000)).toBeCloseTo(575, 6)
  })
  it('tapers at 1.5c in the second band and hits zero by ~$66,667', () => {
    expect(calcLITO(50000)).toBeCloseTo(250, 6)
    expect(calcLITO(70000)).toBe(0)
  })
})

describe('calcMedicare', () => {
  it('is zero below the low-income threshold', () => {
    expect(calcMedicare(26000)).toBe(0)
  })
  it('is 2% above it', () => {
    expect(calcMedicare(120000)).toBeCloseTo(2400, 6)
  })
})

describe('calcHELPRepayment', () => {
  it('is zero below the first repayment threshold', () => {
    expect(calcHELPRepayment(50000)).toBe(0)
  })
  it('applies the banded rate at higher income', () => {
    // 120000 sits in the 114232 band (7%): round(8400)
    expect(calcHELPRepayment(120000)).toBe(8400)
  })
})

describe('calcAfterTax', () => {
  it('nets off tax + medicare (no HELP)', () => {
    // 120000 - 26788 - 2400 = 90812
    expect(calcAfterTax(120000)).toBeCloseTo(90812, 6)
  })
  it('also subtracts HELP when flagged', () => {
    expect(calcAfterTax(120000, true)).toBeCloseTo(90812 - 8400, 6)
  })
})

describe('marginalRate (incl. Medicare)', () => {
  it('returns just the levy below the tax-free threshold', () => {
    expect(marginalRate(10000)).toBeCloseTo(0.02, 6)
  })
  it('returns 32% in the middle bracket', () => {
    expect(marginalRate(120000)).toBeCloseTo(0.32, 6)
  })
  it('returns 47% at the top', () => {
    expect(marginalRate(200000)).toBeCloseTo(0.47, 6)
  })
})

describe('effectiveRate', () => {
  it('is zero at zero income and below the average marginal rate', () => {
    expect(effectiveRate(0)).toBe(0)
    const r = effectiveRate(120000)
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThan(marginalRate(120000))
  })
})
