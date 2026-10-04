import type { Metadata } from 'next'
import { AdminPage } from '@/screens/AdminPage'

export const metadata: Metadata = { title: 'Admin · Tellero' }

export default function Page() {
  return <AdminPage />
}
