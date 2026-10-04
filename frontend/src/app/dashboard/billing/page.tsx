import type { Metadata } from 'next'
import { BillingPage } from '@/screens/BillingPage'

export const metadata: Metadata = { title: 'Plan & billing · Tellero' }

export default function Page() {
  return <BillingPage />
}
