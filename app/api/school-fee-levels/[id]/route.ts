import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tuition, fixed } = await request.json()
  const updated = await prisma.schoolFeeLevel.update({
    where: { id: parseInt(id) },
    data: { tuition, fixed },
  })
  return Response.json(updated)
}
