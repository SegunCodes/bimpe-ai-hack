import type { Metadata } from 'next'
import { BusinessAuth } from '@/components/AuthCard'

export const metadata: Metadata = { title: 'Log in · Tellero' }

export default function Page() {
  return <BusinessAuth mode="login" />
}
