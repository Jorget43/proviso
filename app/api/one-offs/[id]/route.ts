import { NextRequest } from 'next/server'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  const body = await request.json()
  const updated = await prisma.oneOff.update({ where: { id: parseInt(id) }, data: body })
  return Response.json(updated)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  await prisma.oneOff.delete({ where: { id: parseInt(id) } })
  return new Response(null, { status: 204 })
}
