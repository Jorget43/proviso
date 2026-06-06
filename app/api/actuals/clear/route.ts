import { prisma } from '@/lib/db'

export async function DELETE() {
  await prisma.transaction.deleteMany()
  await prisma.suggestionState.deleteMany()
  return new Response(null, { status: 204 })
}
