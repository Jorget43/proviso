import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── Singletons ────────────────────────────────────────────────────────────
  await prisma.mortgageSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, balance: 0, rate: 5.5, payment: 0, offsetBal: 0, endDate: '' },
  });

  await prisma.incomeSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, person1FTE: 0, person2FTE: 0, person2HasHELP: false, taxMode: true, person1MonthlyNet: 0, person2MonthlyNet: 0, person1Age: 30, person2Age: 30 },
  });

  await prisma.projectionSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      id: 1, person1Growth: 3.5, person2Growth: 3.0, expInflNear: 4.0, expInfl: 2.5,
      childcareInfl: 6.0, propGrowth: 3.5, savingsRate: 10.0, investReturn: 3.5,
      projYears: 30, schoolFeesOn: false,
      sfC1Start: 2028, sfC1ExitIdx: 13, sfC2Start: 2031, sfC2ExitIdx: 13, sfInfl: 5.0,
      parentalLeaveEnabled: false,
    },
  });

  await prisma.actualsSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, useActualsProjections: false },
  });

  await prisma.childcareSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, enabled: false, costPerDay: 130, daysPerWeek: 3, numChildren: 1 },
  });

  // ── Expenses ──────────────────────────────────────────────────────────────
  // Only seed if table is empty
  const expCount = await prisma.expense.count();
  if (expCount === 0) {
    await prisma.expense.createMany({
      data: [
        { cat: 'Home',          name: 'Mortgage',              freq: 'monthly',   amt: 0    },
        { cat: 'Home',          name: 'Home & contents ins',   freq: 'monthly',   amt: 0    },
        { cat: 'Food',          name: 'Groceries',             freq: 'monthly',   amt: 1200 },
        { cat: 'Eating Out',    name: 'Eating out',            freq: 'monthly',   amt: 300  },
        { cat: 'Transport',     name: 'Petrol',                freq: 'monthly',   amt: 200  },
        { cat: 'Transport',     name: 'Public transport',      freq: 'monthly',   amt: 100  },
        { cat: 'Insurance',     name: 'Health insurance',      freq: 'monthly',   amt: 100  },
        { cat: 'Subscriptions', name: 'Streaming',             freq: 'monthly',   amt: 30   },
        { cat: 'Utilities',     name: 'Gas',                   freq: 'monthly',   amt: 100  },
        { cat: 'Utilities',     name: 'Electricity',           freq: 'monthly',   amt: 200  },
        { cat: 'Utilities',     name: 'Internet',              freq: 'monthly',   amt: 100  },
        { cat: 'Utilities',     name: 'Mobile phones',         freq: 'monthly',   amt: 80   },
        { cat: 'Fun',           name: 'Misc',                  freq: 'monthly',   amt: 300  },
        { cat: 'Travel',        name: 'Annual holiday',        freq: 'yearly',    amt: 5000 },
      ],
    });
  }

  // ── School fee levels ─────────────────────────────────────────────────────
  // Seed with Australian independent-school-typical values if table is empty.
  // Users can edit these in the Projections tab → School fees section.
  const sfCount = await prisma.schoolFeeLevel.count();
  if (sfCount === 0) {
    await prisma.schoolFeeLevel.createMany({
      data: [
        { level: 'Kindergarten', tuition:  6000, fixed:  600 },
        { level: 'Prep',         tuition:  9000, fixed: 1100 },
        { level: 'Class 1',      tuition: 10000, fixed:  800 },
        { level: 'Class 2',      tuition: 10000, fixed:  800 },
        { level: 'Class 3',      tuition: 11500, fixed: 1100 },
        { level: 'Class 4',      tuition: 11500, fixed: 1500 },
        { level: 'Class 5',      tuition: 11500, fixed: 1200 },
        { level: 'Class 6',      tuition: 11500, fixed: 1500 },
        { level: 'Year 7',       tuition: 12500, fixed: 1900 },
        { level: 'Year 8',       tuition: 12500, fixed: 2100 },
        { level: 'Year 9',       tuition: 12500, fixed: 4000 },
        { level: 'Year 10',      tuition: 13000, fixed: 2300 },
        { level: 'Year 11',      tuition: 13500, fixed: 2700 },
        { level: 'Year 12',      tuition: 14000, fixed: 2400 },
      ],
    });
  }

  // ── Annual expenses ───────────────────────────────────────────────────────
  // Seed with sensible placeholder entries if table is empty.
  // Users can edit, delete, and add their own via the Budget tab.
  const aeCount = await prisma.annualExpense.count();
  if (aeCount === 0) {
    await (prisma.annualExpense.createMany as Function)({
      data: [
        { name: 'Council rates',   cat: 'Home',      amt:  1200, month: 2 },
        { name: 'Car rego',        cat: 'Transport',  amt:   900, month: 5 },
        { name: 'Car insurance',   cat: 'Insurance',  amt:  1500, month: 8 },
      ],
    });
  }

  // ── Debts ─────────────────────────────────────────────────────────────────
  // Not pre-seeded — users add debts through onboarding and the Debts tab

  // ── Assets ────────────────────────────────────────────────────────────────
  // Not pre-seeded — users add assets through onboarding and the Debts tab

  // ── Person 2 work phases ──────────────────────────────────────────────────
  const gpCount = await prisma.person2Phase.count();
  if (gpCount === 0) {
    const currentYear = new Date().getFullYear();
    await prisma.person2Phase.createMany({
      data: [
        { year: currentYear, days: 5 },
      ],
    });
  }

  // ── Life phases ───────────────────────────────────────────────────────────
  const lpCount = await prisma.lifePhase.count();
  if (lpCount === 0) {
    const cy = new Date().getFullYear();
    await prisma.lifePhase.createMany({
      data: [
        { name: 'Child 1 — newborn consumables',              type: 'recurring', monthlyAmt:  500, startYear: cy,     endYear: cy + 2,  cat: 'Children',  enabled: false, sortOrder: 0 },
        { name: 'Daycare — Child 1',                          type: 'recurring', monthlyAmt:  900, startYear: cy + 1, endYear: cy + 4,  cat: 'Children',  enabled: false, sortOrder: 1 },
        { name: 'Child 2 — newborn consumables',              type: 'recurring', monthlyAmt:  500, startYear: cy + 3, endYear: cy + 5,  cat: 'Children',  enabled: false, sortOrder: 2 },
        { name: 'Daycare — Child 2',                          type: 'recurring', monthlyAmt:  900, startYear: cy + 4, endYear: cy + 7,  cat: 'Children',  enabled: false, sortOrder: 3 },
        { name: 'Grocery uplift — family of 4',               type: 'recurring', monthlyAmt:  300, startYear: cy + 3, endYear: cy + 30, cat: 'Food',      enabled: false, sortOrder: 4 },
        { name: 'Utilities uplift — larger household',        type: 'recurring', monthlyAmt:  100, startYear: cy + 3, endYear: cy + 30, cat: 'Utilities', enabled: false, sortOrder: 5 },
        { name: 'Kids clothing & activities',                 type: 'recurring', monthlyAmt:  300, startYear: cy + 3, endYear: cy + 18, cat: 'Children',  enabled: false, sortOrder: 6 },
        { name: 'Holiday uplift — family of 4',               type: 'recurring', monthlyAmt:  250, startYear: cy + 3, endYear: cy + 30, cat: 'Travel',    enabled: false, sortOrder: 7 },
        { name: 'Health insurance step-up',                   type: 'recurring', monthlyAmt:  150, startYear: cy + 5, endYear: cy + 30, cat: 'Insurance', enabled: false, sortOrder: 8 },
      ],
    });
  }

  // ── Rent settings ─────────────────────────────────────────────────────────
  await (prisma.rentSettings as any).upsert({
    where:  { id: 1 },
    update: {},
    create: {
      id: 1, enabled: false, monthlyRent: 0, annualIncreaseRate: 5.0,
      purchasePlanEnabled: false, targetPurchaseYear: new Date().getFullYear() + 5,
      targetPropertyValue: 800000, depositPct: 20.0,
      depositFromCash: 0, depositFromInvestments: 0,
      newMortgageRate: 6.0, newMortgageTermYrs: 30,
    },
  });

  // ── Household settings ────────────────────────────────────────────────────
  await prisma.householdSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, person1Name: 'You', person2Name: 'Partner', partnerEnabled: false, onboardingDone: false },
  });

  // ── Super settings ────────────────────────────────────────────────────────
  await prisma.superSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      id: 1,
      currentBalance: 0, retirementAge: 67, additionalContribs: 0,
      sgRate: 0.12, investmentReturn: 0.06, fundFeePercent: 0.005,
      inflationRate: 0.04, desiredRetirementIncome: 60000,
      partnerEnabled: false, partnerBalance: 0, partnerRetirementAge: 67, partnerAdditionalContribs: 0,
      // Orphaned (kept for DB compat)
      currentAge: 30, salaryExcSuper: 0, salaryGrowthRate: 0.04,
    },
  });

  console.log('✓ Seed complete');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
