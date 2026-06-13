import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'
import TopNav from '@/components/layout/TopNav'
import UpdateBanner from '@/components/ui/UpdateBanner'
import { getSession } from '@/lib/auth'
import { getLatestVersion, isUpdateAvailable } from '@/lib/versionCheck'

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
  const session = await getSession()

  const currentVersion = process.env.PROVISO_VERSION ?? 'dev'
  let updateLatestTag = ''
  if (session?.role === 'CFO' && currentVersion !== 'dev') {
    const versionInfo = await getLatestVersion()
    if (versionInfo && isUpdateAvailable(currentVersion, versionInfo.latestTag)) {
      updateLatestTag = versionInfo.latestTag
    }
  }

  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body>
        <TopNav user={session ? { name: session.name, role: session.role } : null} />
        {updateLatestTag && (
          <UpdateBanner latestTag={updateLatestTag} currentVersion={currentVersion} />
        )}
        {children}
      </body>
    </html>
  )
}
