import type { Metadata } from 'next'
import { JoinPage } from '@/screens/JoinPage'

export const metadata: Metadata = {
  title: 'Get a call from our AI',
  description: 'Enter your number and our AI assistant will call you in seconds.',
}

export default function Page() {
  return <JoinPage />
}
