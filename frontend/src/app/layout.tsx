import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' })

export const metadata: Metadata = {
  title: 'Tellero AI · Delivery calls, handled',
  description: 'Tellero AI’s AI agent phones your customers before the rider leaves: confirms they are home, fixes the address with a landmark, and logs the answer. In English, Pidgin, Yorùbá, Hausa and Igbo.',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#f6f7fb',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
