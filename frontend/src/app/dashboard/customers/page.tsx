import type { Metadata } from 'next'
import { CustomersPage } from '@/screens/CustomersPage'

export const metadata: Metadata = { title: 'Customers · Tellero' }

export default function Page() {
  return <CustomersPage />
}
