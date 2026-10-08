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
    horizonAge:           int.min(50).max(110),
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

const memberName = z.string().trim().min(1).max(40)
const days = z.number().int().min(0).max(5)
const isoDateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Expected YYYY-MM-DD')

export const householdNamesSchema = z
  .object({
    person1Name: memberName,
    person2Name: memberName,
  })
  .partial()

export const onboardingSchema = z.object({
  person1Name:        memberName,
  person1Age:         z.number().int().min(14).max(110),
  person1Income:      money,
  person1HasHELP:     z.boolean(),
  person1HELPBalance: money,
  person1Days:        days,
  hasPartner:         z.boolean(),
  person2Name:        memberName,
  person2Age:         z.number().int().min(0).max(110),
  person2Income:      money,
  person2HasHELP:     z.boolean(),
  person2HELPBalance: money,
  person2Days:        days,
  person1Super:       money,
  person2Super:       money,
  sharesValue:        money,
  cryptoValue:        money,
  otherInvestments:   money,
  cashBalance:        money,
  hasMortgage:        z.boolean(),
  mortgageBalance:    money,
  mortgageRate:       z.number().finite().min(0).max(30),
  mortgageEndDate:    isoDateOrEmpty,
  hasParentalLeave:   z.boolean(),
  // "Your situation" answers (Phase 23). Optional so an older client (or a
  // re-run that skips them) leaves the existing settings untouched.
  renting:            z.boolean().optional(),
  monthlyRent:        money.optional(),
  payChildcare:       z.boolean().optional(),
  schoolFees:         z.boolean().optional(),
})

// ── Phase 19: schemas for the routes that still read raw JSON ─────────────────

const text = (max: number) => z.string().trim().max(max)
const label = (max = 200) => z.string().trim().min(1).max(max)
const year = z.number().int().min(1900).max(2200)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const pct = (min: number, max: number) => z.number().finite().min(min).max(max)

export const phaseCreateSchema = z.object({
  year,
  days: z.number().int().min(0).max(5).optional(),  // each route keeps its own default
})

export const annualExpenseSchema = z.object({
  name:  label(),
  cat:   label(60),
  amt:   money,
  month: z.number().int().min(1).max(12),
})

export const actualsSettingsSchema = z.object({
  useActualsProjections: z.boolean(),
}).partial()

export const childcareSettingsSchema = z.object({
  enabled:     z.boolean(),
  costPerDay:  money,
  daysPerWeek: z.number().int().min(0).max(5),
  numChildren: z.number().int().min(0).max(10),
}).partial()

export const helpDebtDetailSchema = z.object({
  member:              memberName,
  financialYearEnding: year,
  openingFyBalance:    money.optional(),
  estimatedWithheld:   money.optional(),
  voluntaryRepayments: money.optional(),
  cpiRate:             pct(-5, 20).optional(),
})

export const superHistorySchema = z.object({
  member:               memberName,
  financialYearEnding:  year,
  concessionalCap:      money,
  concessionalUtilised: money,
  totalSuperBalance:    money,
})

export const netWorthSnapshotSchema = z.object({
  netWorth: num,
  takenAt:  z.union([isoDate, z.literal('')]).optional(),
})

export const donationSchema = z.object({
  charity:     label(),
  abn:         text(20).optional(),
  amount:      money,
  date:        isoDate,
  financialYr: year,
  source:      z.enum(['manual', 'imported']).optional(),
  txnId:       z.number().int().positive().nullable().optional(),
  notes:       text(1000).optional(),
})

export const workExpenseSchema = z.object({
  description: label(),
  amount:      money,
  date:        isoDate,
  category:    label(60).optional(),
  financialYr: year,
  source:      z.enum(['manual', 'imported']).optional(),
  txnId:       z.number().int().positive().nullable().optional(),
  receiptRef:  text(200).optional(),
  notes:       text(1000).optional(),
})

export const rentSettingsSchema = z.object({
  enabled:                z.boolean(),
  monthlyRent:            money,
  annualIncreaseRate:     pct(-20, 50),
  purchasePlanEnabled:    z.boolean(),
  targetPurchaseYear:     year,
  targetPropertyValue:    money,
  depositPct:             pct(0, 100),
  depositFromCash:        money,
  depositFromInvestments: money,
  newMortgageRate:        pct(0, 30),
  newMortgageTermYrs:     z.number().int().min(1).max(40),
}).partial()

// Body uses HouseholdSuperInputs field names (rates as decimals).
export const superSettingsSchema = z.object({
  person1Balance:            money,
  person1RetirementAge:      z.number().int().min(18).max(100),
  person1AdditionalContribs: money,
  sgRate:                    pct(0, 0.5),
  investmentReturn:          pct(-0.5, 0.5),
  fundFeePercent:            pct(0, 0.2),
  inflationRate:             pct(-0.1, 0.3),
  desiredRetirementIncome:   money,
  partnerEnabled:            z.boolean(),
  person2Balance:            money,
  person2RetirementAge:      z.number().int().min(18).max(100),
  person2AdditionalContribs: money,
  drawdownStrategy:          z.enum(['need', 'fourPercent', 'percentOfBalance', 'minimum']),
  drawdownPct:               z.number().min(0).max(30),
}).partial()

export const schoolFeeLevelSchema = z.object({
  tuition: money,
  fixed:   money,
})

export const allowanceSchema = z.object({
  userId:    z.number().int().positive(),
  amount:    money,
  dayOfWeek: z.number().int().min(0).max(6).default(5),
})

export const pocketMoneySchema = z.object({
  userId:      z.number().int().positive().optional(),
  amount:      num.refine(v => v !== 0, 'Amount must not be zero'),
  description: label(),
  date:        isoDate,
  category:    label(40).optional(),
})

const role = z.enum(['CFO', 'PARTNER', 'CHILD'])
const password = z.string().min(8, 'Password must be at least 8 characters').max(200)

export const userCreateSchema = z.object({
  name:     label(60),
  username: label(40),
  password,
  role,
})

export const userUpdateSchema = z.object({
  role,
  password,
  email: z.union([z.string().trim().email().max(200), z.literal(''), z.null()]),
}).partial()

export const suggestionStateSchema = z.object({
  status: z.enum(['pending', 'accepted', 'dismissed']),
})

export const ruleCreateSchema = z.object({
  pattern: label(100),
  cat:     label(60),
})

// ── Auth (public) ────────────────────────────────────────────────────────────

export const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
})

export const setupSchema = z.object({
  name:     label(60),
  username: label(40),
  password,
})

export const forgotPasswordSchema = z.object({
  username: z.string().trim().max(100).optional(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password,
})

export const totpVerifySchema = z.object({
  nonce:      z.string().min(1).max(100),
  code:       z.string().trim().min(1).max(40),
  isRecovery: z.boolean().optional(),
})

export const totpEnableSchema = z.object({
  secret: z.string().min(1).max(200),
  code:   z.string().trim().min(1).max(20),
})

export const totpDisableSchema = z.object({
  password: z.string().min(1).max(200),
})
