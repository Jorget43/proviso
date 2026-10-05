import { describe, it, expect } from 'vitest'
import {
  calcIncomeTax,
  calcLITO,
  calcMedicare,
  calcHELPRepayment,
  calcAfterTax,
  marginalRate,
  effectiveRate,
  TAX_FY,
  MEDICARE_UPPER_THRESH,
  HELP_TOP_THRESHOLD,
} from '../src/tax'

// These pin the ATO FY2026-27 outputs. When the figures are updated for a new
// financial year, these expected values must be recomputed deliberately —
// that is the point: an accidental change to the money math fails the suite.

it('is calibrated for FY2026-27', () => {
  expect(TAX_FY).toBe(2027)
})

describe('calcIncomeTax (FY2026-27)', () => {
  it('is zero at/below the tax-free threshold', () => {
    expect(calcIncomeTax(0)).toBe(0)
    expect(calcIncomeTax(18200)).toBe(0)
    expect(calcIncomeTax(-5000)).toBe(0)
  })

  it('applies the 15% bracket net of LITO at low income', () => {
    // (30000-18200)*0.15 = 1770; LITO at 30k = 700; → 1070
    expect(calcIncomeTax(30000)).toBeCloseTo(1070, 6)
  })

  it('matches a $120k salary', () => {
    // 26800*0.15 + 75000*0.30 = 4020 + 22500 = 26520; LITO 0
    expect(calcIncomeTax(120000)).toBeCloseTo(26520, 6)
  })

  it('matches a $200k salary across all brackets', () => {
    // 4020 + 90000*0.30 + 55000*0.37 + 10000*0.45 = 4020+27000+20350+4500
    expect(calcIncomeTax(200000)).toBeCloseTo(55870, 6)
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
  it('is zero at or below the low-income threshold', () => {
    expect(calcMedicare(20000)).toBe(0)
    expect(calcMedicare(28011)).toBe(0)
  })
  it('shades in at 10c per $1 over the threshold', () => {
    // (30000-28011)*0.10 = 198.9, less than 2% (600)
    expect(calcMedicare(30000)).toBeCloseTo(198.9, 6)
  })
  it('meets the full 2% at the upper threshold — no cliff', () => {
    expect(calcMedicare(MEDICARE_UPPER_THRESH)).toBeCloseTo(MEDICARE_UPPER_THRESH * 0.02, 0)
    expect(calcMedicare(MEDICARE_UPPER_THRESH + 1)).toBeCloseTo((MEDICARE_UPPER_THRESH + 1) * 0.02, 6)
  })
  it('is 2% above it', () => {
    expect(calcMedicare(120000)).toBeCloseTo(2400, 6)
  })
})

describe('calcHELPRepayment (marginal system)', () => {
  it('is zero at or below the repayment threshold', () => {
    expect(calcHELPRepayment(60000)).toBe(0)
    expect(calcHELPRepayment(69528)).toBe(0)
  })
  it('charges 15c per $1 over the threshold', () => {
    // (100000-69528)*0.15 = 4570.8
    expect(calcHELPRepayment(100000)).toBe(4571)
  })
  it('adds 17c per $1 over the second band', () => {
    // (129717-69528)*0.15 = 9028.35; + (150000-129717)*0.17 = 3448.11 → 12476.46
    expect(calcHELPRepayment(150000)).toBe(12476)
  })
  it('switches to 10% of total income at the top, without a jump', () => {
    expect(calcHELPRepayment(200000)).toBe(20000)
    const below = calcHELPRepayment(HELP_TOP_THRESHOLD)
    const above = calcHELPRepayment(HELP_TOP_THRESHOLD + 1)
    expect(Math.abs(above - below)).toBeLessThanOrEqual(1)
  })
})

describe('calcAfterTax', () => {
  it('nets off tax + medicare (no HELP)', () => {
    // 120000 - 26520 - 2400 = 91080
    expect(calcAfterTax(120000)).toBeCloseTo(91080, 6)
  })
  it('also subtracts HELP when flagged', () => {
    // HELP at 120k: (120000-69528)*0.15 = 7570.8 → 7571
    expect(calcAfterTax(120000, true)).toBeCloseTo(91080 - 7571, 6)
  })
})

describe('marginalRate (incl. Medicare)', () => {
  it('returns just the levy below the tax-free threshold', () => {
    expect(marginalRate(10000)).toBeCloseTo(0.02, 6)
  })
  it('returns 17% in the lowest taxed bracket', () => {
    expect(marginalRate(30000)).toBeCloseTo(0.17, 6)
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
