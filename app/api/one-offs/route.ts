import { NextRequest } from 'next/server'
import { withErrors } from '@/lib/apiHandler'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const oneoffs = await prisma.oneOff.findMany({ orderBy: { year: 'asc' } })
  return Response.json(oneoffs)
}

export const POST = withErrors(async (request: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await request.json()
  const oneoff = await prisma.oneOff.create({
    data: { name: body.name ?? 'New expense', amt: body.amt ?? 0, year: body.year ?? new Date().getFullYear() + 1 },
  })
  return Response.json(oneoff, { status: 201 })
})
