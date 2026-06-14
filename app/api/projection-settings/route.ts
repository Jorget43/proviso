import { NextRequest } from 'next/server'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function GET() {
  const s = await prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } })
  return Response.json(s)
}

export async function PUT(request: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await request.json()
  const updated = await prisma.projectionSettings.update({ where: { id: 1 }, data: body })
  return Response.json(updated)
}
