export async function GET() {
  return Response.json({ version: process.env.PROVISO_VERSION ?? 'dev' })
}
