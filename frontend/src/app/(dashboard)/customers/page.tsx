import type { Metadata } from 'next'
import { CustomersPage } from '@/screens/CustomersPage'

export const metadata: Metadata = { title: 'Customers · Bimpe' }

export default function Page() {
  return <CustomersPage />
}
