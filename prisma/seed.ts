import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── Singletons ────────────────────────────────────────────────────────────
  await prisma.mortgageSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, balance: 530073, rate: 5.99, payment: 3237, offsetBal: 47563, endDate: '2053-01-16' },
  });

  await prisma.incomeSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, jorgeFTE: 150000, graceFTE: 100000, graceHasHELP: true, taxMode: true, jorgeMonthlyNet: 9176, graceMonthlyNet: 4436, jorgeAge: 34, graceAge: 32 },
  });

  await prisma.projectionSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      id: 1, jorgeGrowth: 3.5, graceGrowth: 3.0, expInflNear: 4.0, expInfl: 2.5,
      childcareInfl: 6.0, propGrowth: 3.5, savingsRate: 10.0, investReturn: 3.5,
      projYears: 20, schoolFeesOn: false,
      sfC1Start: 2028, sfC1ExitIdx: 13, sfC2Start: 2031, sfC2ExitIdx: 13, sfInfl: 5.0,
    },
  });

  await prisma.actualsSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, useActualsProjections: false },
  });

  // ── Expenses ──────────────────────────────────────────────────────────────
  // Only seed if table is empty
  const expCount = await prisma.expense.count();
  if (expCount === 0) {
    await prisma.expense.createMany({
      data: [
        { cat: 'Home',          name: 'Mortgage',                 freq: 'monthly',   amt: 2990.61 },
        { cat: 'Home',          name: 'Home improvement',         freq: 'quarterly', amt: 500     },
        { cat: 'Home',          name: 'Home & contents ins',      freq: 'monthly',   amt: 181.54  },
        { cat: 'Food',          name: 'Groceries',                freq: 'monthly',   amt: 1400    },
        { cat: 'Food',          name: 'Eating out',               freq: 'monthly',   amt: 300     },
        { cat: 'Transport',     name: 'Car rego (car 1)',          freq: 'quarterly', amt: 439.56  },
        { cat: 'Transport',     name: 'Petrol',                   freq: 'monthly',   amt: 250     },
        { cat: 'Transport',     name: 'Public transport',         freq: 'monthly',   amt: 100     },
        { cat: 'Insurance',     name: 'Health insurance',         freq: 'monthly',   amt: 97      },
        { cat: 'Subscriptions', name: 'Prime Video',              freq: 'monthly',   amt: 3       },
        { cat: 'Subscriptions', name: 'Meds',                     freq: 'monthly',   amt: 40      },
        { cat: 'Subscriptions', name: 'Amazon',                   freq: 'monthly',   amt: 200     },
        { cat: 'Subscriptions', name: 'Apple',                    freq: 'monthly',   amt: 4.50    },
        { cat: 'Subscriptions', name: 'Google',                   freq: 'monthly',   amt: 34      },
        { cat: 'Subscriptions', name: 'HBO Max',                  freq: 'monthly',   amt: 6       },
        { cat: 'Utilities',     name: 'Gas',                      freq: 'monthly',   amt: 100     },
        { cat: 'Utilities',     name: 'Electricity',              freq: 'monthly',   amt: 270     },
        { cat: 'Utilities',     name: 'Internet',                 freq: 'monthly',   amt: 129     },
        { cat: 'Utilities',     name: 'Water',                    freq: 'monthly',   amt: 150     },
        { cat: 'Utilities',     name: 'Mobile phones',            freq: 'monthly',   amt: 43      },
        { cat: 'Fun',           name: 'Alcohol',                  freq: 'monthly',   amt: 200     },
        { cat: 'Fun',           name: 'Gifts',                    freq: 'quarterly', amt: 200     },
        { cat: 'Fun',           name: 'Misc',                     freq: 'monthly',   amt: 300     },
        { cat: 'Fun',           name: 'Annual holiday',           freq: 'yearly',    amt: 10000   },
        { cat: 'Children',      name: 'Childcare',                freq: 'monthly',   amt: 800     },
        { cat: 'Children',      name: 'Kids clothes & shoes',     freq: 'quarterly', amt: 200     },
        { cat: 'Children',      name: 'Kids activities',          freq: 'monthly',   amt: 100     },
        { cat: 'Pets',          name: 'Wormer',                   freq: 'quarterly', amt: 90      },
        { cat: 'Pets',          name: 'Vet',                      freq: 'yearly',    amt: 900     },
        { cat: 'Pets',          name: 'Dog food',                 freq: 'quarterly', amt: 120     },
      ],
    });
  }

  // ── Debts ─────────────────────────────────────────────────────────────────
  const debtCount = await prisma.debt.count();
  if (debtCount === 0) {
    await prisma.debt.createMany({
      data: [
        { name: 'Mortgage',        amt: 530560 },
        { name: 'Person2 HELP debt', amt: 60000  },
      ],
    });
  }

  // ── Assets ────────────────────────────────────────────────────────────────
  const assetCount = await prisma.asset.count();
  if (assetCount === 0) {
    await prisma.asset.createMany({
      data: [
        { name: 'House equity',    amt: 479440 },
        { name: 'Cash / savings',  amt: 52700  },
        { name: 'Crypto',          amt: 5548   },
      ],
    });
  }

  // ── Person2 phases ──────────────────────────────────────────────────────────
  const gpCount = await prisma.gracePhase.count();
  if (gpCount === 0) {
    await prisma.gracePhase.createMany({
      data: [
        { year: 2026, days: 3 },
        { year: 2028, days: 0 },
        { year: 2029, days: 3 },
        { year: 2031, days: 4 },
        { year: 2033, days: 5 },
      ],
    });
  }

  // ── One-off home expenses ─────────────────────────────────────────────────
  const ooCount = await prisma.oneOff.count();
  if (ooCount === 0) {
    await prisma.oneOff.createMany({
      data: [
        { name: 'Render house',        amt: 30000, year: 2027 },
        { name: 'Study paint',         amt: 800,   year: 2026 },
        { name: 'Solar panels',        amt: 35000, year: 2027 },
        { name: 'Study wardrobe',      amt: 2500,  year: 2028 },
        { name: 'Palm Cove trip',      amt: 10000, year: 2026 },
        { name: 'Double glazing',      amt: 20000, year: 2030 },
        { name: 'Paint house',         amt: 20000, year: 2029 },
        { name: 'Redo carpets',        amt: 20000, year: 2031 },
        { name: 'Skylight bedroom 3',  amt: 10000, year: 2032 },
      ],
    });
  }

  // ── Life phases ───────────────────────────────────────────────────────────
  const lpCount = await prisma.lifePhase.count();
  if (lpCount === 0) {
    await prisma.lifePhase.createMany({
      data: [
        { name: 'Baby 2 — OB & hospital (private)',                  type: 'oneoff',    monthlyAmt:  8000, startYear: 2028, endYear: 2028, cat: 'Children',  enabled: true,  sortOrder: 0 },
        { name: 'Baby 2 newborn consumables',                        type: 'recurring', monthlyAmt:   500, startYear: 2028, endYear: 2030, cat: 'Children',  enabled: true,  sortOrder: 1 },
        { name: 'Daycare — Child 2',                                 type: 'recurring', monthlyAmt:   900, startYear: 2029, endYear: 2032, cat: 'Children',  enabled: true,  sortOrder: 2 },
        { name: 'Childcare phase-out (Child 1 starts school)',       type: 'phaseout',  monthlyAmt:  -800, startYear: 2029, endYear: 2029, cat: 'Children',  enabled: true,  sortOrder: 3 },
        { name: 'Grocery uplift — family of 4',                      type: 'recurring', monthlyAmt:   300, startYear: 2028, endYear: 2100, cat: 'Food',      enabled: true,  sortOrder: 4 },
        { name: 'Utilities uplift — 4 people',                       type: 'recurring', monthlyAmt:   100, startYear: 2028, endYear: 2100, cat: 'Utilities', enabled: true,  sortOrder: 5 },
        { name: 'Petrol uplift — school runs & activities',          type: 'recurring', monthlyAmt:   120, startYear: 2028, endYear: 2100, cat: 'Transport', enabled: true,  sortOrder: 6 },
        { name: 'Kids clothing — growing children',                  type: 'recurring', monthlyAmt:   200, startYear: 2028, endYear: 2042, cat: 'Children',  enabled: true,  sortOrder: 7 },
        { name: 'Holiday uplift — family of 4',                      type: 'recurring', monthlyAmt:   250, startYear: 2028, endYear: 2100, cat: 'Fun',       enabled: true,  sortOrder: 8 },
        { name: 'Kids activities — 1 child (sport, music, parties)', type: 'recurring', monthlyAmt:   350, startYear: 2029, endYear: 2034, cat: 'Children',  enabled: true,  sortOrder: 9 },
        { name: 'Kids activities — 2 children',                      type: 'recurring', monthlyAmt:   700, startYear: 2032, endYear: 2044, cat: 'Children',  enabled: true,  sortOrder: 10 },
        { name: 'Birthday parties & gifts — kids',                   type: 'recurring', monthlyAmt:   150, startYear: 2028, endYear: 2040, cat: 'Fun',       enabled: true,  sortOrder: 11 },
        { name: 'School camps & excursions',                         type: 'recurring', monthlyAmt:   200, startYear: 2030, endYear: 2044, cat: 'Children',  enabled: true,  sortOrder: 12 },
        { name: 'Health insurance step-up (job change)',             type: 'recurring', monthlyAmt:   253, startYear: 2030, endYear: 2100, cat: 'Insurance', enabled: true,  sortOrder: 13 },
        { name: 'Before/after school care — Child 1',                type: 'recurring', monthlyAmt:   400, startYear: 2034, endYear: 2037, cat: 'Children',  enabled: true,  sortOrder: 14 },
        { name: 'Before/after school care — Child 2',                type: 'recurring', monthlyAmt:   400, startYear: 2037, endYear: 2040, cat: 'Children',  enabled: true,  sortOrder: 15 },
        { name: 'Teen uplift — food, phone, social, transport, driving', type: 'recurring', monthlyAmt: 500, startYear: 2038, endYear: 2044, cat: 'Children', enabled: true, sortOrder: 16 },
      ],
    });
  }

  // ── Super settings ────────────────────────────────────────────────────────
  await prisma.superSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      id: 1,
      currentBalance: 164000, retirementAge: 67, additionalContribs: 0,
      sgRate: 0.12, investmentReturn: 0.06, fundFeePercent: 0.005,
      inflationRate: 0.04, desiredRetirementIncome: 80000,
      partnerEnabled: true, partnerBalance: 80000, partnerRetirementAge: 67, partnerAdditionalContribs: 0,
      // Orphaned (kept for DB compat)
      currentAge: 34, salaryExcSuper: 135035, salaryGrowthRate: 0.04,
    },
  });

  console.log('✓ Seed complete');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
