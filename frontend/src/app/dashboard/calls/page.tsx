import type { Metadata } from 'next'
import { LiveCallsPage } from '@/screens/LiveCallsPage'

export const metadata: Metadata = { title: 'Live calls · Tellero' }

export default function Page() {
  return <LiveCallsPage />
}
