import { NextRequest } from 'next/server'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function GET() {
  const phases = await prisma.person1Phase.findMany({ orderBy: { year: 'asc' } })
  return Response.json(phases)
}

export async function POST(request: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await request.json()
  const phase = await prisma.person1Phase.create({ data: { year: body.year, days: body.days ?? 5 } })
  return Response.json(phase, { status: 201 })
}
