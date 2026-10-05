// "What applies to us" — the life situations that switch whole sections of
// the app on or off. Each flag lives in the settings row of the feature it
// belongs to; this module just gathers them so they can be shown and changed
// in one place (Settings → Your situation, summarised on Home).
import { prisma } from '@/lib/db'

export interface Situation {
  partnerEnabled: boolean
  childcare:      boolean   // ChildcareSettings.enabled
  renting:        boolean   // RentSettings.enabled
  buying:         boolean   // RentSettings.purchasePlanEnabled (only meaningful while renting)
  schoolFees:     boolean   // ProjectionSettings.schoolFeesOn
  parentalLeave:  boolean   // ProjectionSettings.parentalLeaveEnabled (needs a partner)
}

export async function loadSituation(): Promise<Situation> {
  const [hs, childcare, rent, proj] = await Promise.all([
    prisma.householdSettings.findUnique({ where: { id: 1 }, select: { partnerEnabled: true } }),
    prisma.childcareSettings.findUnique({ where: { id: 1 }, select: { enabled: true } }),
    prisma.rentSettings.findUnique({ where: { id: 1 }, select: { enabled: true, purchasePlanEnabled: true } }),
    prisma.projectionSettings.findUnique({ where: { id: 1 }, select: { schoolFeesOn: true, parentalLeaveEnabled: true } }),
  ])
  return {
    partnerEnabled: hs?.partnerEnabled ?? false,
    childcare:      childcare?.enabled ?? false,
    renting:        rent?.enabled ?? false,
    buying:         (rent?.enabled ?? false) && (rent?.purchasePlanEnabled ?? false),
    schoolFees:     proj?.schoolFeesOn ?? false,
    parentalLeave:  (hs?.partnerEnabled ?? false) && (proj?.parentalLeaveEnabled ?? false),
  }
}

/** Short labels for the situations that are switched on, for summaries. */
export function situationLabels(s: Situation, person2Name: string): string[] {
  return [
    s.partnerEnabled ? `With ${person2Name}` : 'Just me',
    s.renting ? (s.buying ? 'Renting, planning to buy' : 'Renting') : 'Own our home',
    ...(s.childcare ? ['Paying for childcare'] : []),
    ...(s.schoolFees ? ['Planning school fees'] : []),
    ...(s.parentalLeave ? ['Parental leave ahead'] : []),
  ]
}
