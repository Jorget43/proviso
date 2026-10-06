// "What applies to us" — read from the NAS database. The type, the rules and
// the wording live in packages/core/src/situation.ts, shared with the app.
import { prisma } from '@/lib/db'
import { situationFrom, type Situation } from '@proviso/core/situation'

export type { Situation }

export async function loadSituation(): Promise<Situation> {
  const [hs, childcare, rent, projection] = await Promise.all([
    prisma.householdSettings.findUnique({ where: { id: 1 }, select: { partnerEnabled: true } }),
    prisma.childcareSettings.findUnique({ where: { id: 1 }, select: { enabled: true } }),
    prisma.rentSettings.findUnique({ where: { id: 1 }, select: { enabled: true, purchasePlanEnabled: true } }),
    prisma.projectionSettings.findUnique({ where: { id: 1 }, select: { schoolFeesOn: true, parentalLeaveEnabled: true } }),
  ])
  return situationFrom({ partnerEnabled: hs?.partnerEnabled, childcare, rent, projection })
}
