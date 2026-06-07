// EOFY optimisation helpers (Phase 2C)
//
// Pulls the seasonal levers together: HELP indexation (1 June), super
// concessional top-ups (30 June), and marginal-rate optimisation via salary
// sacrifice. This module owns the salary-sacrifice maths and the season gate;
// HELP and carry-forward maths live in lib/help.ts and lib/superHistory.ts.

import { marginalRate } from './tax'

// EOFY run-up: May and June (HELP indexes 1 June, contributions close 30 June).
export function isEofySeason(now: Date = new Date()): boolean {
  const month = now.getMonth() + 1
  return month === 5 || month === 6
}

// ATO bracket thresholds where the marginal rate steps up (2024-25 Stage 3).
const BRACKET_THRESHOLDS = [45_000, 135_000, 190_000]
const DIV293_THRESHOLD = 250_000

export interface SalarySacrificeInsight {
  grossSalary:          number
  sgContrib:            number  // employer SG already counting toward the cap
  concessionalRoom:     number  // headroom to salary sacrifice up to the cap
  marginalRate:         number  // incl. Medicare levy
  contributionsTaxRate: number  // 0.15, or 0.30 above the Div 293 threshold
  // Tax saved by sacrificing the full room: room × (marginal − contributions tax)
  taxSavingFull:        number
  // Bracket boundary just below gross salary, if any
  nextLowerThreshold:   number | null
  // Sacrifice needed to drop taxable income to that boundary (≤ room), else null
  sacrificeToThreshold: number | null
  crossesBracket:       boolean
}

// `maxConcessional` is the cap available this FY (standard cap, plus usable
// carry-forward when eligible). `existingExtra` is any salary sacrifice /
// personal deductible already planned beyond employer SG.
export function computeSalarySacrifice(
  grossSalary: number,
  sgRate: number,
  maxConcessional: number,
  existingExtra = 0,
): SalarySacrificeInsight {
  const sgContrib = grossSalary * sgRate
  const concessionalRoom = Math.max(0, maxConcessional - sgContrib - existingExtra)
  const mr = marginalRate(grossSalary)
  const contributionsTaxRate = grossSalary > DIV293_THRESHOLD ? 0.30 : 0.15
  const taxSavingFull = concessionalRoom * Math.max(0, mr - contributionsTaxRate)

  // Nearest bracket boundary below current income.
  const below = BRACKET_THRESHOLDS.filter(t => t < grossSalary).sort((a, b) => b - a)[0] ?? null
  let sacrificeToThreshold: number | null = null
  let crossesBracket = false
  if (below !== null) {
    const need = grossSalary - below
    if (need > 0 && need <= concessionalRoom) {
      sacrificeToThreshold = Math.ceil(need)
      crossesBracket = true
    }
  }

  return {
    grossSalary,
    sgContrib,
    concessionalRoom,
    marginalRate: mr,
    contributionsTaxRate,
    taxSavingFull,
    nextLowerThreshold: below,
    sacrificeToThreshold,
    crossesBracket,
  }
}
