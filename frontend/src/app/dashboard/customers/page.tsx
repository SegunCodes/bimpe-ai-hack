import type { Metadata } from 'next'
import { CustomersPage } from '@/screens/CustomersPage'

export const metadata: Metadata = { title: 'Customers · Tellero AI' }

export default function Page() {
  return <CustomersPage />
}
