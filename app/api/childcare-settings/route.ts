import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export async function GET() {
  const settings = await prisma.childcareSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1 },
  })
  return Response.json(settings)
}

export async function PUT(request: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await request.json()
  const updated = await prisma.childcareSettings.upsert({
    where:  { id: 1 },
    update: body,
    create: { id: 1, ...body },
  })
  return Response.json(updated)
}
