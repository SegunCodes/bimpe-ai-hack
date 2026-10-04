import type { Metadata } from 'next'
import { VerifyEmail } from '@/components/AuthFlows'

export const metadata: Metadata = { title: 'Confirm your email · Tellero AI', robots: { index: false } }

export default function Page() {
  return <VerifyEmail />
}
