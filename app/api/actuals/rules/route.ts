import { NextRequest } from 'next/server'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function GET() {
  const rules = await prisma.categoriationRule.findMany({ orderBy: { id: 'asc' } })
  return Response.json(rules)
}

export async function POST(request: NextRequest) {
  const gate = await authorize('actuals:write')
  if (!gate.ok) return gate.res
  const body = await request.json()
  const rule = await prisma.categoriationRule.upsert({
    where:  { pattern: body.pattern.toLowerCase() },
    update: { cat: body.cat },
    create: { pattern: body.pattern.toLowerCase(), cat: body.cat, source: 'user', hits: 0 },
  })
  return Response.json(rule, { status: 201 })
}
