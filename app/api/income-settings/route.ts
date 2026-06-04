import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET() {
  const settings = await prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } })
  return Response.json(settings)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const updated = await prisma.incomeSettings.update({
    where: { id: 1 },
    data: body,
  })
  return Response.json(updated)
}
