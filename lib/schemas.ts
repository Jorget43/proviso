// Zod request-body schemas for the mutating routes that previously passed an
// untyped `await req.json()` straight into Prisma (Phase 14). Used via
// parseBody(req, schema) from lib/apiHandler.
//
// Update routes accept a partial subset of a model's fields, so schemas are
// `.partial()`. Zod strips unknown keys by default, so stray/extra fields never
// reach Prisma. Numeric fields reject NaN/Infinity via `.finite()`.

import { z } from 'zod'

const num = z.number().finite()
const money = z.number().finite().nonnegative()
const int = z.number().int()

export const expenseSchema = z
  .object({
    cat:  z.string().min(1),
    name: z.string().min(1),
    freq: z.enum(['monthly', 'quarterly', 'yearly', 'weekly']),
    amt:  money,
  })
  .partial()

export const debtSchema = z
  .object({
    name: z.string().min(1),
    amt:  num,
  })
  .partial()

export const assetSchema = z
  .object({
    name:     z.string().min(1),
    amt:      num,
    isOffset: z.boolean(),
  })
  .partial()

export const mortgageSettingsSchema = z
  .object({
    balance:   money,
    rate:      num,
    payment:   money,
    offsetBal: money,
    endDate:   z.string(),
  })
  .partial()

export const incomeSettingsSchema = z
  .object({
    taxMode:           z.boolean(),
    person1FTE:        num,
    person2FTE:        num,
    person1HasHELP:    z.boolean(),
    person2HasHELP:    z.boolean(),
    person1MonthlyNet: num,
    person2MonthlyNet: num,
    person1Age:        int,
    person2Age:        int,
  })
  .partial()

export const projectionSettingsSchema = z
  .object({
    person1Growth:        num,
    person2Growth:        num,
    expInflNear:          num,
    expInfl:              num,
    childcareInfl:        num,
    propGrowth:           num,
    savingsRate:          num,
    investReturn:         num,
    projYears:            int.positive(),
    schoolFeesOn:         z.boolean(),
    sfC1Start:            int,
    sfC1ExitIdx:          int,
    sfC2Start:            int,
    sfC2ExitIdx:          int,
    sfInfl:               num,
    sfPresetKey:          z.string().nullable(),
    parentalLeaveEnabled: z.boolean(),
  })
  .partial()

// Person1Phase / Person2Phase share the same shape.
export const phaseSchema = z
  .object({
    year: int,
    days: int,
  })
  .partial()

export const oneOffSchema = z
  .object({
    name: z.string().min(1),
    amt:  num,
    year: int,
  })
  .partial()

export const lifePhaseSchema = z
  .object({
    name:       z.string().min(1),
    type:       z.enum(['recurring', 'oneoff', 'phaseout']),
    monthlyAmt: num,
    startYear:  int,
    endYear:    int,
    cat:        z.string(),
    enabled:    z.boolean(),
    sortOrder:  int,
  })
  .partial()

export const investmentParcelSchema = z
  .object({
    member:        z.string().min(1),
    name:          z.string().min(1),
    quantity:      money,
    purchasePrice: money,
    purchaseDate:  z.string(),
    currentPrice:  money,
    sellYear:      int.nullable(),
  })
  .partial()

export const categorisationRuleSchema = z
  .object({
    pattern: z.string().min(1),
    cat:     z.string().min(1),
    source:  z.string(),
    hits:    int,
  })
  .partial()

// actuals/commit posts a full array of transactions to createMany.
export const transactionArraySchema = z.array(
  z.object({
    dateStr:     z.string(),
    ym:          z.string(),
    desc:        z.string(),
    amt:         num,
    cat:         z.string(),
    originalCat: z.string(),
    catSource:   z.string(),
    lumpy:       z.boolean(),
  }),
)
