import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const s = await prisma.actualsSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, useActualsProjections: false },
  })
  return Response.json(s)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const s = await prisma.actualsSettings.upsert({
    where:  { id: 1 },
    update: body,
    create: { id: 1, ...body },
  })
  return Response.json(s)
}
