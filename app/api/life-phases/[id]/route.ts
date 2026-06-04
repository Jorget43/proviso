import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const updated = await prisma.lifePhase.update({ where: { id: parseInt(id) }, data: body })
  return Response.json(updated)
}
