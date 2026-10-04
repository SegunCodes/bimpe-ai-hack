import type { Metadata } from 'next'
import { ResetPassword } from '@/components/AuthFlows'

export const metadata: Metadata = { title: 'Reset your password · Tellero AI' }

export default function Page() {
  return <ResetPassword />
}
