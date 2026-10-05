import type { MetadataRoute } from 'next'

// "Add to Home Screen" support: opens full-screen like an installed app.
// Served at /manifest.webmanifest, which the proxy leaves public — browsers
// fetch it without cookies.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'Proviso',
    short_name:       'Proviso',
    description:      'Your household, modelled.',
    start_url:        '/',
    scope:            '/',
    display:          'standalone',
    orientation:      'portrait',
    background_color: '#F5F2EC',
    theme_color:      '#1A1610',
    icons: [
      { src: '/icons/icon-192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
