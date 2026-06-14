import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'
import TopNav from '@/components/layout/TopNav'
import UpdateBanner from '@/components/ui/UpdateBanner'
import { getSession } from '@/lib/auth'

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
})

const dmSerif = DM_Serif_Display({
  variable: '--font-dm-serif',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Proviso',
  description: 'Your household, modelled.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Guard against database unavailable (corrupted file, disk full, etc.).
  // Degrading to null here lets the layout render; page-level calls may still
  // throw and will be caught by app/error.tsx or app/global-error.tsx.
  let session: Awaited<ReturnType<typeof getSession>> = null
  try { session = await getSession() } catch { /* DB unavailable — fall through */ }

  const currentVersion = process.env.PROVISO_VERSION ?? 'dev'

  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body>
        <TopNav user={session ? { name: session.name, role: session.role } : null} />
        {session && <UpdateBanner currentVersion={currentVersion} />}
        {children}
      </body>
    </html>
  )
}
