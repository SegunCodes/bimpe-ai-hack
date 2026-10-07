import type { Metadata } from 'next'
import { RiderPage } from '@/screens/RiderPage'

export const metadata: Metadata = {
  title: 'Delivery details · Tellero AI',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function Page({ params }: { params: Promise<{ order: string; signature: string }> }) {
  const { order, signature } = await params
  return <RiderPage orderId={order} signature={signature} />
}
