import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const s = await prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } })
  return Response.json(s)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const updated = await prisma.projectionSettings.update({ where: { id: 1 }, data: body })
  return Response.json(updated)
}
