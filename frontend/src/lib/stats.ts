import type { Call, Customer, OrderRow } from './types'
import { isActiveCall, parseDate } from './format'
import { parseTranscript } from './transcript'

export type Range = 'today' | '7d' | '30d' | 'all'

/** Outcomes where the conversation achieved what it was for. */
export const GOOD_OUTCOMES = ['confirmed', 'rescheduled', 'address_updated', 'verified']
const NO_PICKUP_OUTCOMES = ['no_answer', 'busy', 'voicemail', 'unanswered']

/** What happened on one finished call, in plain terms. */
export type CallResult = 'live' | 'good' | 'incomplete' | 'not_picked'

/**
 * Did the customer pick up? Yes if they said anything, or if the call reached a real outcome.
 * A call with no customer speech and no outcome counts as not picked up.
 */
export function classifyCall(call: Call): CallResult {
  if (isActiveCall(call.status) || call.status === 'queued') return 'live'
  const outcome = (call.outcome || '').toLowerCase()
  if (GOOD_OUTCOMES.includes(outcome)) return 'good'
  if (NO_PICKUP_OUTCOMES.includes(outcome)) return 'not_picked'
  const spoke = parseTranscript(call.transcript)?.some((t) => t.speaker === 'customer' && t.text.trim() !== '')
  return spoke ? 'incomplete' : 'not_picked'
}

const HOUR = 3_600_000
const DAY = 24 * HOUR
const LAGOS_OFFSET = HOUR // Africa/Lagos is UTC+1 all year

function startOfLagosDay(t: number): number {
  return Math.floor((t + LAGOS_OFFSET) / DAY) * DAY - LAGOS_OFFSET
}

export function rangeStart(range: Range, now: number): number {
  if (range === 'today') return startOfLagosDay(now)
  if (range === '7d') return startOfLagosDay(now) - 6 * DAY
  if (range === '30d') return startOfLagosDay(now) - 29 * DAY
  return 0
}

const time = (value: string | null | undefined) => parseDate(value)?.getTime() ?? 0
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null)

export interface Bucket {
  label: string
  good: number
  incomplete: number
  notPicked: number
}

export interface Business {
  id: number
  name: string
  orders: number
  calls: number
  picked: number
  good: number
  pickRate: number | null
  goodRate: number | null
}

export interface Stats {
  calls: {
    total: number
    delivery: number
    onboarding: number
    live: number
    finished: number
    picked: number
    notPicked: number
    good: number
    incomplete: number
    pickRate: number | null
    goodRate: number | null
    avgTalkSeconds: number | null
    totalTalkSeconds: number
  }
  outcomes: { key: string; label: string; count: number; tone: 'done' | 'changed' | 'attention' }[]
  customers: {
    total: number
    contacted: number
    reached: number
    neverPicked: number
    onboarded: number
    consented: number
    languages: { code: string; count: number }[]
  }
  orders: { total: number; confirmed: number; changed: number; needsYou: number; retried: number }
  businesses: Business[]
  series: Bucket[]
}

/** `names` lists the businesses to report on (id → name); calls and orders of other accounts are ignored for the business table. */
export function computeStats(
  calls: Call[],
  orders: OrderRow[],
  customers: Customer[],
  range: Range,
  names: Map<number, string> = new Map(),
  now = Date.now(),
): Stats {
  const from = rangeStart(range, now)
  const inRange = <T extends { created_at: string }>(items: T[]) => items.filter((i) => time(i.created_at) >= from)
  // Customer numbers only: rider briefings are calls to the business's own riders.
  const rangeCalls = inRange(calls.filter((c) => c.call_type !== 'rider'))
  const rangeOrders = inRange(orders)
  const results = new Map(rangeCalls.map((c) => [c.id, classifyCall(c)]))
  const count = (r: CallResult) => [...results.values()].filter((x) => x === r).length

  const good = count('good')
  const incomplete = count('incomplete')
  const notPicked = count('not_picked')
  const live = count('live')
  const picked = good + incomplete
  const talked = rangeCalls.filter((c) => results.get(c.id) !== 'not_picked' && results.get(c.id) !== 'live' && (c.duration_seconds ?? 0) > 0)
  const totalTalkSeconds = talked.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0)

  // Outcomes of finished calls
  const outcomeCount = (keys: string[]) => rangeCalls.filter((c) => keys.includes((c.outcome || '').toLowerCase())).length
  const outcomes: Stats['outcomes'] = [
    { key: 'confirmed', label: 'Delivery confirmed', count: outcomeCount(['confirmed']), tone: 'done' },
    { key: 'verified', label: 'Customer onboarded', count: outcomeCount(['verified']), tone: 'done' },
    { key: 'address_updated', label: 'Address fixed', count: outcomeCount(['address_updated']), tone: 'changed' },
    { key: 'rescheduled', label: 'New delivery time', count: outcomeCount(['rescheduled']), tone: 'changed' },
    { key: 'incomplete', label: 'Picked up, didn’t finish', count: incomplete, tone: 'attention' },
    { key: 'not_picked', label: 'Didn’t pick up', count: notPicked, tone: 'attention' },
  ]

  // Customers
  const contactedIds = new Set(rangeCalls.map((c) => c.customer_id).filter((id): id is number => id !== null))
  const reachedIds = new Set(
    rangeCalls.filter((c) => ['good', 'incomplete'].includes(results.get(c.id)!)).map((c) => c.customer_id).filter((id): id is number => id !== null),
  )
  const languageCounts = new Map<string, number>()
  for (const c of customers) {
    if (c.status !== 'verified' || !c.language) continue
    languageCounts.set(c.language, (languageCounts.get(c.language) ?? 0) + 1)
  }

  // Businesses: each account's orders and calls in this period (the website account is left out).
  const businesses = new Map<number, Business>()
  const business = (id: number) => {
    if (!businesses.has(id)) businesses.set(id, { id, name: names.get(id) ?? `Business ${id}`, orders: 0, calls: 0, picked: 0, good: 0, pickRate: null, goodRate: null })
    return businesses.get(id)!
  }
  for (const id of names.keys()) business(id)
  for (const o of rangeOrders) business(o.business_id).orders++
  for (const c of rangeCalls) {
    const r = results.get(c.id)
    if (r === 'live') continue
    const b = business(c.business_id)
    b.calls++
    if (r === 'good' || r === 'incomplete') b.picked++
    if (r === 'good') b.good++
  }
  for (const b of businesses.values()) {
    b.pickRate = pct(b.picked, b.calls)
    b.goodRate = pct(b.good, b.picked)
  }

  return {
    calls: {
      total: rangeCalls.length,
      delivery: rangeCalls.filter((c) => c.call_type === 'delivery').length,
      onboarding: rangeCalls.filter((c) => c.call_type === 'onboarding').length,
      live,
      finished: rangeCalls.length - live,
      picked,
      notPicked,
      good,
      incomplete,
      pickRate: pct(picked, picked + notPicked),
      goodRate: pct(good, picked),
      avgTalkSeconds: talked.length ? Math.round(totalTalkSeconds / talked.length) : null,
      totalTalkSeconds,
    },
    outcomes,
    customers: {
      total: customers.length,
      contacted: contactedIds.size,
      reached: reachedIds.size,
      neverPicked: [...contactedIds].filter((id) => !reachedIds.has(id)).length,
      onboarded: customers.filter((c) => c.status === 'verified').length,
      consented: customers.filter((c) => c.consent_to_calls === 1).length,
      languages: [...languageCounts.entries()].map(([code, n]) => ({ code, count: n })).sort((a, b) => b.count - a.count),
    },
    orders: {
      total: rangeOrders.length,
      confirmed: rangeOrders.filter((o) => o.status === 'confirmed').length,
      changed: rangeOrders.filter((o) => ['rescheduled', 'address_updated'].includes(o.status)).length,
      needsYou: rangeOrders.filter((o) => ['no_answer', 'failed'].includes(o.status)).length,
      retried: rangeOrders.filter((o) => (o.attempts ?? 0) > 1).length,
    },
    businesses: [...businesses.values()].filter((b) => names.has(b.id)).sort((a, b) => b.calls - a.calls || b.orders - a.orders),
    series: buildSeries(rangeCalls, results, range, now),
  }
}

/** Calls over time: by hour for today, by day otherwise (all time: up to the last 60 days). */
function buildSeries(calls: Call[], results: Map<number, CallResult>, range: Range, now: number): Bucket[] {
  const hourly = range === 'today'
  const step = hourly ? HOUR : DAY
  let start = rangeStart(range, now)
  if (range === 'all') {
    const first = Math.min(...calls.map((c) => time(c.created_at)).filter(Boolean), now)
    start = Math.max(startOfLagosDay(first), startOfLagosDay(now) - 59 * DAY)
  }
  const n = hourly ? 24 : Math.max(1, Math.round((startOfLagosDay(now) - start) / DAY) + 1)
  const buckets: Bucket[] = Array.from({ length: n }, (_, i) => {
    const at = new Date(start + i * step)
    const label = hourly
      ? at.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: 'numeric' })
      : at.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' })
    return { label, good: 0, incomplete: 0, notPicked: 0 }
  })
  for (const c of calls) {
    const i = Math.floor((time(c.created_at) - start) / step)
    const b = buckets[i]
    const r = results.get(c.id)
    if (!b || r === 'live') continue
    if (r === 'good') b.good++
    else if (r === 'incomplete') b.incomplete++
    else b.notPicked++
  }
  return buckets
}
