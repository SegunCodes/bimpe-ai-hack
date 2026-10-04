import type { Metadata } from 'next'
import { JoinPage } from '@/screens/JoinPage'

export const metadata: Metadata = {
  title: 'Get a call from Tellero AI',
  description: 'Enter your number and Tellero AI will call you in seconds.',
}

export default function Page() {
  return <JoinPage />
}
