import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await prisma.superHistory.delete({ where: { id: parseInt(id) } })
  return new Response(null, { status: 204 })
}
