'use client'

import { useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { formatDuration, languageName } from '../lib/format'
import { computeStats, type Range, type Stats } from '../lib/stats'
import { usePolling } from '../hooks/usePolling'
import { PageHeader, StatCard } from '../components/Layout'
import { Segmented } from '../components/Overlay'
import { ErrorState, LoadingState, StaleBanner } from '../components/States'

async function fetchAll() {
  const [calls, orders, customers] = await Promise.all([api.listCalls(), api.listOrders(), api.listCustomers()])
  return { calls, orders, customers }
}

const RANGES: { value: Range; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
]

/** One colour per kind of call result, used by every chart on the page. */
const RESULT_COLOURS = {
  good: 'bg-good',
  incomplete: 'bg-danfo',
  notPicked: 'bg-ink/20',
}

const fmtPct = (value: number | null) => (value === null ? '—' : `${value}%`)

function talkTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function Card({ title, hint, children, className = '' }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/10 sm:p-6 ${className}`}>
      <h2 className="font-display text-lg font-bold text-ink sm:text-xl">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-ink-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
      {[
        ['good', 'Went well'],
        ['incomplete', 'Picked up, didn’t finish'],
        ['notPicked', 'Didn’t pick up'],
      ].map(([key, label]) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${RESULT_COLOURS[key as keyof typeof RESULT_COLOURS]}`} />
          {label}
        </span>
      ))}
    </div>
  )
}

/** Calls made → picked up → went well, as three bars against the same scale. */
function Funnel({ stats }: { stats: Stats }) {
  const { finished, picked, good } = stats.calls
  const steps = [
    { label: 'Calls finished', value: finished, note: `${stats.calls.total} made${stats.calls.live ? `, ${stats.calls.live} live now` : ''}`, colour: 'bg-ink' },
    { label: 'Picked up', value: picked, note: `${fmtPct(stats.calls.pickRate)} of finished calls`, colour: 'bg-danfo' },
    { label: 'Went well', value: good, note: `${fmtPct(stats.calls.goodRate)} of picked-up calls`, colour: 'bg-good' },
  ]
  return (
    <div className="flex flex-col gap-4">
      {steps.map((s) => (
        <div key={s.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-base font-semibold text-ink">{s.label}</span>
            <span className="font-display text-2xl font-bold tabular-nums text-ink">{s.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-mist">
            <div className={`h-full rounded-full ${s.colour} transition-[width] duration-500`} style={{ width: `${finished ? (s.value / finished) * 100 : 0}%` }} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">{s.note}</p>
        </div>
      ))}
    </div>
  )
}

/** Stacked bars: each bar is one hour (today) or one day, split by call result. */
function CallsChart({ stats }: { stats: Stats }) {
  const series = stats.series
  const max = Math.max(1, ...series.map((b) => b.good + b.incomplete + b.notPicked))
  const every = Math.ceil(series.length / 8) // label at most ~8 bars so labels never collide
  if (stats.calls.finished === 0) return <p className="py-10 text-center text-base text-ink-muted">No finished calls in this period.</p>
  return (
    <div>
      <div className="flex h-44 items-end gap-[3px] sm:gap-1.5" role="img" aria-label="Calls over time, split by result">
        {series.map((b, i) => {
          const total = b.good + b.incomplete + b.notPicked
          return (
            <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.label}: ${total} calls · ${b.good} went well · ${b.incomplete} didn’t finish · ${b.notPicked} not picked`}>
              <div className="flex flex-col overflow-hidden rounded-t-md" style={{ height: `${(total / max) * 100}%` }}>
                <div className={RESULT_COLOURS.notPicked} style={{ flexGrow: b.notPicked }} />
                <div className={RESULT_COLOURS.incomplete} style={{ flexGrow: b.incomplete }} />
                <div className={RESULT_COLOURS.good} style={{ flexGrow: b.good }} />
              </div>
              {total === 0 && <div className="h-[3px] rounded-full bg-mist" />}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-[3px] sm:gap-1.5">
        {series.map((b, i) => (
          <div key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] text-ink-faint">
            {i % every === 0 ? b.label : ''}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Legend />
      </div>
    </div>
  )
}

function Outcomes({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...stats.outcomes.map((o) => o.count))
  const colour = { done: 'bg-good', changed: 'bg-ink', attention: 'bg-bad' }
  return (
    <ul className="flex flex-col gap-3">
      {stats.outcomes.map((o) => (
        <li key={o.key}>
          <div className="mb-1 flex justify-between gap-3 text-[15px]">
            <span className="text-ink-soft">{o.label}</span>
            <span className="font-semibold tabular-nums text-ink">{o.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-mist">
            <div
              className={`h-full rounded-full ${o.key === 'not_picked' ? RESULT_COLOURS.notPicked : o.key === 'incomplete' ? RESULT_COLOURS.incomplete : colour[o.tone]}`}
              style={{ width: `${(o.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Figure({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl bg-paper px-3.5 py-3">
      <div className="text-[13px] font-semibold text-ink-muted">{label}</div>
      <div className="mt-0.5 font-display text-2xl font-bold tabular-nums text-ink">{value}</div>
      {note && <div className="text-xs text-ink-muted">{note}</div>}
    </div>
  )
}

function Businesses({ stats }: { stats: Stats }) {
  if (stats.businesses.length === 0) return <p className="py-6 text-center text-base text-ink-muted">No orders from businesses in this period.</p>
  return (
    <>
      {/* Phones: one row per business */}
      <ul className="divide-y divide-line sm:hidden">
        {stats.businesses.map((b) => (
          <li key={b.name} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-base font-semibold text-ink">{b.name}</span>
              <span className="shrink-0 text-sm text-ink-muted">{b.orders} orders</span>
            </div>
            <div className="mt-1 text-sm text-ink-muted">
              {b.calls} calls · {fmtPct(b.pickRate)} picked up · {fmtPct(b.goodRate)} went well
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th className="py-3 pr-3">Business</th>
              <th className="px-3 py-3 text-right">Orders</th>
              <th className="px-3 py-3 text-right">Calls</th>
              <th className="px-3 py-3 text-right">Picked up</th>
              <th className="py-3 pl-3 text-right">Went well</th>
            </tr>
          </thead>
          <tbody>
            {stats.businesses.map((b) => (
              <tr key={b.name} className="border-b border-line last:border-0">
                <td className="py-3 pr-3 text-base font-semibold text-ink">{b.name}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{b.orders}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{b.calls}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{fmtPct(b.pickRate)}</td>
                <td className="py-3 pl-3 text-right tabular-nums text-ink-soft">{fmtPct(b.goodRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function AdminPage() {
  const [range, setRange] = useState<Range>('7d')
  const { data, error, loading, refresh } = usePolling(fetchAll, 'admin', 10_000)

  if (loading && !data) return <LoadingState label="Counting calls…" />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />
  if (!data) return null

  const stats = computeStats(data.calls, data.orders, data.customers, range)
  const { calls, customers, orders } = stats

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="How Tellero's calls are going: who picked up, how the conversations went, and which businesses use it."
        actions={<Segmented id="admin-range" options={RANGES} value={range} onChange={setRange} className="w-full sm:w-[420px]" />}
      />
      {error && <StaleBanner message={error} />}

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Calls made" value={calls.total} />
        <StatCard label="Picked up" value={fmtPct(calls.pickRate)} />
        <StatCard label="Went well" value={fmtPct(calls.goodRate)} />
        <StatCard label="Customers reached" value={customers.reached} />
      </div>
      <p className="mb-6 text-sm text-ink-muted">
        “Picked up” is out of finished calls. “Went well” is out of picked-up calls: the delivery was confirmed, the address fixed, a new time agreed, or the customer onboarded.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Calls over time" hint={range === 'today' ? 'By hour, Lagos time' : 'By day, Lagos time'} className="lg:col-span-2">
          <CallsChart stats={stats} />
        </Card>
        <Card title="From call to result">
          <Funnel stats={stats} />
        </Card>

        <Card title="How calls ended">
          <Outcomes stats={stats} />
        </Card>

        <Card title="Customers" hint="Reached means they picked up at least once in this period.">
          <div className="grid grid-cols-2 gap-2.5">
            <Figure label="Contacted" value={customers.contacted} />
            <Figure label="Reached" value={customers.reached} />
            <Figure label="Never picked up" value={customers.neverPicked} />
            <Figure label="Onboarded" value={customers.onboarded} note="all time" />
            <Figure label="Agreed to calls" value={customers.consented} note="all time" />
            <Figure label="In your list" value={customers.total} note="all time" />
          </div>
          {customers.languages.length > 0 && (
            <p className="mt-4 text-sm text-ink-muted">
              Onboarded customers prefer:{' '}
              <span className="text-ink-soft">{customers.languages.map((l) => `${languageName(l.code)} ${l.count}`).join(' · ')}</span>
            </p>
          )}
        </Card>

        <Card title="Calls and talk time">
          <div className="grid grid-cols-2 gap-2.5">
            <Figure label="Delivery calls" value={calls.delivery} />
            <Figure label="Onboarding calls" value={calls.onboarding} />
            <Figure label="Average call" value={calls.avgTalkSeconds === null ? '—' : formatDuration(calls.avgTalkSeconds)} note="picked-up calls" />
            <Figure label="Total talk time" value={talkTime(calls.totalTalkSeconds)} />
            <Figure label="Orders" value={orders.total} note={`${orders.confirmed} confirmed · ${orders.changed} changed`} />
            <Figure label="Orders needing you" value={orders.needsYou} note={`${orders.retried} needed a retry`} />
          </div>
        </Card>

        <Card
          title={`Businesses (${stats.businesses.length})`}
          hint="Every seller with orders in this period. Calls are delivery calls for their orders."
          className="lg:col-span-3"
        >
          <Businesses stats={stats} />
        </Card>
      </div>
    </>
  )
}
