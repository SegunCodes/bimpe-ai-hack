import type { Metadata } from 'next'
import { JoinPage } from '@/screens/JoinPage'

export const metadata: Metadata = {
  title: 'Get a call from Tellero',
  description: 'Enter your number and Tellero will call you in seconds.',
}

export default function Page() {
  return <JoinPage />
}
