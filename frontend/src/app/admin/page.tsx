import type { Metadata } from 'next'
import { AdminPage } from '@/screens/AdminPage'

export const metadata: Metadata = { title: 'Admin · Tellero AI', robots: { index: false } }

export default function Page() {
  return <AdminPage />
}
