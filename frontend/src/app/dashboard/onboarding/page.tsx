import type { Metadata } from 'next'
import { OnboardingPage } from '@/screens/OnboardingPage'

export const metadata: Metadata = { title: 'Set up your account · Tellero AI' }

export default function Page() {
  return <OnboardingPage />
}
