'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatDateTime, formatDuration, languageName } from '../lib/format'
import { computeStats, type Range, type Stats } from '../lib/stats'
import { SIGNED_OUT_EVENT, clearToken, getToken, type SessionKind } from '../lib/session'
import type { AdminBusiness, AdminOverview, Capacity } from '../lib/types'
import { Button } from '../components/Button'
import { inputClass } from '../components/Overlay'
import { usePolling } from '../hooks/usePolling'
import { AdminSignIn } from '../components/AdminSignIn'
import { PhoneIcon } from '../components/Icons'
import { PageHeader, StatCard } from '../components/Layout'
import { Segmented } from '../components/Overlay'
import { ErrorState, LoadingState, StaleBanner } from '../components/States'
import { useToast } from '../components/Toast'

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

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`

function PlanCell({ business }: { business: AdminBusiness }) {
  const p = business.plan
  if (business.is_house) return <span className="text-ink-muted">Website demo, no plan needed</span>
  if (!p.active) return <span className="font-semibold text-bad">{p.planName ? `${p.planName} ended` : 'No plan'}</span>
  return (
    <span className="text-ink-soft">
      <span className="font-semibold text-ink">{p.planName}</span> · until {formatDateTime(p.expiresAt)}
      {p.outOfCredits && <span className="font-semibold text-bad"> · out of credits</span>}
    </span>
  )
}

/** Switch a plan on or off by hand (demos, bank transfers, or before Paystack is set up). */
function PlanSwitch({ business, plans, onChanged }: { business: AdminBusiness; plans: AdminOverview['plans']; onChanged: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (business.is_house) return null
  const set = async (plan: string) => {
    setBusy(true)
    try {
      await api.adminSetPlan(business.id, plan === 'none' ? null : plan)
      toast.success(plan === 'none' ? `Turned off ${business.name}'s plan` : `${business.name} is on ${plans.find((p) => p.id === plan)?.name} for 30 days`)
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <select
      aria-label={`Change ${business.name}'s plan`}
      disabled={busy}
      value=""
      onChange={(e) => e.target.value && set(e.target.value)}
      className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink ring-1 ring-ink/20 disabled:opacity-50"
    >
      <option value="">{busy ? 'Saving…' : 'Set plan…'}</option>
      {plans.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.calls} calls)
        </option>
      ))}
      <option value="none">Turn plan off</option>
    </select>
  )
}

/**
 * Tellero's shared BimpeAI minutes this month. All businesses' calls come out of one BimpeAI
 * account, so this is the number to watch: when it fills up, new calls pause for everyone.
 */
function CapacityCard({ capacity, onChanged }: { capacity: Capacity; onChanged: () => void }) {
  const toast = useToast()
  const [minutes, setMinutes] = useState('')
  const [busy, setBusy] = useState(false)
  const used = Math.min(100, (capacity.minutesUsed / Math.max(1, capacity.minuteBudget)) * 100)
  const short = capacity.minutesNeededForCredits - capacity.minutesLeft
  const save = async () => {
    const value = Number(minutes)
    if (!Number.isInteger(value) || value < 0) return toast.error('Enter a whole number of minutes.')
    setBusy(true)
    try {
      await api.adminSetCapacity(value)
      toast.success(`This month's BimpeAI minutes set to ${value}`)
      setMinutes('')
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={`mb-4 rounded-3xl p-4 shadow-sm ring-1 sm:p-6 ${capacity.paused ? 'bg-bad-soft ring-bad/20' : 'bg-white ring-ink/10'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-ink sm:text-xl">BimpeAI minutes this month</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Every business’s calls come out of your one BimpeAI account. When it’s full, new calls pause for everyone.</p>
        </div>
        {capacity.paused && <span className="rounded-full bg-bad px-3 py-1 text-sm font-semibold text-white">Calls paused</span>}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <span className="font-display text-3xl font-bold tabular-nums text-ink">
          {capacity.minutesUsed} <span className="text-lg font-semibold text-ink-muted">of {capacity.minuteBudget} min</span>
        </span>
        <span className="text-sm text-ink-muted">
          {capacity.onThePhone}/{capacity.maxConcurrentCalls} lines busy now
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-mist">
        <div className={`h-full rounded-full ${capacity.paused ? 'bg-bad' : used > 80 ? 'bg-danfo' : 'bg-ink'}`} style={{ width: `${used}%` }} />
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        ≈ ₦{(capacity.minutesUsed * capacity.costPerMinuteNaira).toLocaleString('en-NG')} of BimpeAI usage · {capacity.minutesLeft} min left ·{' '}
        {capacity.budgetSetByAdmin ? 'set by you for this month' : 'default budget'}
      </p>
      <p className={`mt-3 rounded-2xl px-4 py-3 text-[15px] ${short > 0 ? 'bg-danfo-soft text-ink ring-1 ring-danfo/60' : 'bg-paper text-ink-soft'}`}>
        Businesses hold <b>{capacity.creditsOutstanding}</b> unused call credits, about <b>{capacity.minutesNeededForCredits} min</b> of calls.{' '}
        {short > 0 ? (
          <>That’s {short} min more than you have left. Top up your BimpeAI wallet, then raise the minutes below.</>
        ) : (
          <>You have enough minutes to cover them.</>
        )}
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">After topping up BimpeAI, set this month’s minutes</span>
          <input type="number" inputMode="numeric" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder={String(capacity.minuteBudget)} className={inputClass} />
        </label>
        <Button size="md" onClick={save} loading={busy} disabled={!minutes}>
          Save
        </Button>
      </div>
    </section>
  )
}

function Businesses({ overview, stats, onChanged }: { overview: AdminOverview; stats: Stats; onChanged: () => void }) {
  const rate = new Map(stats.businesses.map((b) => [b.id, b]))
  if (overview.businesses.length === 0) return <p className="py-6 text-center text-base text-ink-muted">No businesses have signed up yet.</p>
  return (
    <ul className="divide-y divide-line">
      {overview.businesses.map((b) => {
        const r = rate.get(b.id)
        return (
          <li key={b.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-base font-semibold text-ink">{b.name}</span>
                {b.email && <span className="truncate text-sm text-ink-muted">{b.email}</span>}
              </div>
              <div className="mt-0.5 text-sm">
                <PlanCell business={b} />
              </div>
              <div className="mt-1 text-sm text-ink-muted">
                Joined {formatDateTime(b.created_at)} · {b.customers} customers · {b.orders} orders · {b.calls} calls
                {r && r.calls > 0 && ` · ${fmtPct(r.pickRate)} picked up · ${fmtPct(r.goodRate)} went well (this period)`}
              </div>
              <div className="mt-1 text-sm text-ink-soft">
                This month: <b className="text-ink">{b.usage.answeredThisMonth}</b> answered calls · <b className="text-ink">{b.usage.minutesThisMonth}</b> min · costs you ≈{' '}
                {naira(b.usage.costThisMonthNaira)} · paid you {naira(b.usage.revenueNaira)} in total · <b className="text-ink">{b.plan.callsLeft}</b> credits left
              </div>
            </div>
            <PlanSwitch business={b} plans={overview.plans} onChanged={onChanged} />
          </li>
        )
      })}
    </ul>
  )
}

/** /admin: the platform owner's own sign-in and frame, separate from business dashboards. */
export function AdminPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(Boolean(getToken('admin')))
    const onSignedOut = (e: Event) => {
      if ((e as CustomEvent<SessionKind>).detail === 'admin') setSignedIn(false)
    }
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [])
  if (signedIn === null) return <div className="min-h-screen bg-ink" />
  if (!signedIn) return <AdminSignIn onSignedIn={() => setSignedIn(true)} />
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-ink text-white">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-danfo text-ink" aria-label="Tellero home">
            <PhoneIcon className="h-5 w-5" />
          </Link>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold">Tellero admin</div>
            <div className="text-xs text-white/55">All businesses</div>
          </div>
          <button onClick={() => clearToken('admin')} className="btn ml-auto rounded-xl px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white">
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-8 sm:py-8">
        <AdminDashboard />
      </main>
    </div>
  )
}

function AdminDashboard() {
  const [range, setRange] = useState<Range>('7d')
  const { data, error, loading, refresh } = usePolling(api.adminOverview, 'admin', 10_000)

  if (loading && !data) return <LoadingState label="Counting calls…" />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />
  if (!data) return null

  const names = new Map(data.businesses.filter((b) => !b.is_house).map((b) => [b.id, b.name]))
  const stats = computeStats(data.calls, data.orders, data.customers, range, names)
  const accounts = data.businesses.filter((b) => !b.is_house)
  const paying = accounts.filter((b) => b.plan.active).length
  const { calls, customers, orders } = stats

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="Every business on Tellero: who signed up, who's paying, and how their calls are going."
        actions={<Segmented id="admin-range" options={RANGES} value={range} onChange={setRange} className="w-full sm:w-[420px]" />}
      />
      {error && <StaleBanner message={error} />}
      <CapacityCard capacity={data.capacity} onChanged={refresh} />

      <div className="mb-2.5 grid grid-cols-2 gap-2.5 sm:mb-3 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Businesses signed up" value={accounts.length} />
        <StatCard label="On a paid plan" value={paying} />
        <StatCard label="Without a plan" value={accounts.length - paying} />
        <StatCard label="Revenue (all time)" value={naira(data.revenue.totalNaira)} />
      </div>
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

        <Card title={`Businesses (${accounts.length})`} hint="Every account, its plan and its calls. Use “Set plan” to switch a plan on by hand." className="lg:col-span-3">
          <Businesses overview={{ ...data, businesses: accounts }} stats={stats} onChanged={refresh} />
        </Card>
      </div>
    </>
  )
}
