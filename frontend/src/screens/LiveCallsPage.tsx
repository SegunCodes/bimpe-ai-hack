'use client'

import { isActiveCall } from '../lib/format'
import { PageHeader, StatCard } from '../components/Layout'
import { LiveFeed, useFeed } from '../components/LiveFeed'

const GOOD_OUTCOMES = ['confirmed', 'rescheduled', 'address_updated', 'verified', 'onboarded', 'completed']

function FeedStats() {
  const { data } = useFeed()
  if (!data || data.calls.length === 0) return null
  const calls = data.calls
  return (
    <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
      <StatCard label="On a call right now" value={calls.filter((c) => isActiveCall(c.status)).length} marker="live" />
      <StatCard label="Total calls" value={calls.length} />
      <StatCard label="Deliveries" value={calls.filter((c) => c.call_type === 'delivery').length} />
      <StatCard label="Successful outcomes" value={calls.filter((c) => c.outcome && GOOD_OUTCOMES.includes(c.outcome)).length} />
    </div>
  )
}

export function LiveCallsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Live calls" subtitle="Every call Tellero AI makes, newest first. Updates every 3 seconds. Tap a call to read the transcript." />
      <FeedStats />
      <LiveFeed />
    </div>
  )
}
