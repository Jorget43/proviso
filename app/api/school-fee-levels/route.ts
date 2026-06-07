import { prisma } from '@/lib/db'

export async function GET() {
  const levels = await prisma.schoolFeeLevel.findMany({ orderBy: { id: 'asc' } })
  return Response.json(levels)
}
