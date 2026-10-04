import type { Metadata } from 'next'
import { BusinessAuth } from '@/components/AuthCard'

export const metadata: Metadata = { title: 'Create your account · Tellero AI' }

export default function Page() {
  return <BusinessAuth mode="signup" />
}
