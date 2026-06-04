import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json()
  const updated = await prisma.debt.update({ where: { id: parseInt(id) }, data: body })
  return Response.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await prisma.debt.delete({ where: { id: parseInt(id) } })
  return new Response(null, { status: 204 })
}
