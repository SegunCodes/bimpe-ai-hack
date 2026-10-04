import type { Metadata } from 'next'
import { AdminPage } from '@/screens/AdminPage'

export const metadata: Metadata = { title: 'Admin · Tellero', robots: { index: false } }

export default function Page() {
  return <AdminPage />
}
