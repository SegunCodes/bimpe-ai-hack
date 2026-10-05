'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatDuration, languageName, timeAgo } from '../lib/format'
import { computeStats, type Range, type Stats } from '../lib/stats'
import { SIGNED_OUT_EVENT, clearToken, getToken, type SessionKind } from '../lib/session'
import type { AdminOverview, Capacity } from '../lib/types'
import { Button } from '../components/Button'
import { inputClass } from '../components/Overlay'
import { usePolling } from '../hooks/usePolling'
import { AdminSignIn } from '../components/AdminSignIn'
import { CheckIcon, PhoneIcon, Wordmark } from '../components/Icons'
import { BusinessesView } from './admin/Businesses'
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

/**
 * Tellero AI's shared BimpeAI minutes this month. All businesses' calls come out of one BimpeAI
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
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-danfo text-ink" aria-label="Tellero AI home">
            <PhoneIcon className="h-5 w-5" />
          </Link>
          <div className="leading-tight">
            <div className="flex items-center gap-2 text-lg"><Wordmark /> <span className="font-display font-bold">admin</span></div>
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

type AdminTab = 'businesses' | 'usage' | 'system'
const TABS: { value: AdminTab; label: string }[] = [
  { value: 'businesses', label: 'Businesses' },
  { value: 'usage', label: 'Usage' },
  { value: 'system', label: 'System' },
]

function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('businesses')
  const { data, error, loading, refresh } = usePolling(api.adminOverview, 'admin', 10_000)

  if (loading && !data) return <LoadingState label="Loading businesses…" />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />
  if (!data) return null
  const review = data.businesses.filter((b) => b.verification.status === 'pending' && !b.suspended).length

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="Every business on Tellero AI, their calls, and the health of the service."
        actions={
          <Segmented
            id="admin-tab"
            options={TABS.map((t) => ({ ...t, label: t.value === 'businesses' && review > 0 ? `Businesses · ${review}` : t.label }))}
            value={tab}
            onChange={setTab}
            className="w-full sm:w-[460px]"
          />
        }
      />
      {error && <StaleBanner message={error} />}
      {tab === 'businesses' && <BusinessesView overview={data} onChanged={refresh} />}
      {tab === 'usage' && <UsageView data={data} onChanged={refresh} />}
      {tab === 'system' && <SystemView />}
    </>
  )
}

function UsageView({ data, onChanged }: { data: AdminOverview; onChanged: () => void }) {
  const [range, setRange] = useState<Range>('7d')
  const names = new Map(data.businesses.filter((b) => !b.is_house).map((b) => [b.id, b.name]))
  const stats = computeStats(data.calls, data.orders, data.customers, range, names)
  const { calls, customers, orders } = stats

  return (
    <>
      <CapacityCard capacity={data.capacity} onChanged={onChanged} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">Calls across every business</h2>
        <Segmented id="admin-range" options={RANGES} value={range} onChange={setRange} className="w-full sm:w-[420px]" />
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
      </div>
    </>
  )
}

/** What used to be the public status page, now for the admin only. */
function SystemView() {
  const { data, error, loading, refresh } = usePolling(api.adminSystemStatus, 'admin-system', 15_000)
  if (loading && !data) return <LoadingState label="Checking the service…" />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />
  if (!data) return null

  const run = data.lastBackgroundRun
  const runAge = run ? (Date.now() - new Date(run.at).getTime()) / 60_000 : Infinity
  const timerOk = run !== null && runAge < 3
  const checks: { label: string; ok: boolean; detail: string }[] = [
    { label: 'Database', ok: data.database === 'ok', detail: data.database === 'ok' ? 'Connected' : data.database },
    {
      label: 'Background job',
      ok: timerOk && run?.ok !== false,
      detail: !run
        ? 'Hasn’t run yet. Check the every-minute timer.'
        : `Last ran ${timeAgo(run.at)}${run.ok ? '' : ' with errors'}${timerOk ? '' : '. It should run every minute: check the timer.'}`,
    },
    { label: 'Call script on the phone agent', ok: data.agentScript.status === 'up to date', detail: data.agentScript.problem ?? data.agentScript.status },
    { label: 'Calling', ok: data.settings.callProviderKey && !data.mockMode, detail: data.mockMode ? 'Demo mode: calls are simulated' : data.settings.callProviderKey ? 'Real calls on' : 'Key missing' },
    { label: 'Payments', ok: data.settings.payments, detail: data.settings.payments ? 'Online payments on' : 'Key missing: plans can only be switched on by hand' },
    { label: 'Email', ok: data.settings.email, detail: data.settings.email ? 'Sending' : 'Key missing: sign-up codes can’t be sent' },
    { label: 'Admin password', ok: data.settings.adminPassword, detail: data.settings.adminPassword ? 'Set' : 'Missing' },
    { label: 'Timer secret', ok: data.settings.cronSecret, detail: data.settings.cronSecret ? 'Set' : 'Missing: the every-minute job can’t be called' },
  ]
  const problems = checks.filter((c) => !c.ok).length

  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
      <div className={`px-5 py-4 sm:px-6 ${problems ? 'bg-bad-soft' : 'bg-good-soft'}`}>
        <p className={`font-display text-xl font-bold ${problems ? 'text-bad' : 'text-good'}`}>
          {problems ? `${problems} thing${problems === 1 ? '' : 's'} need${problems === 1 ? 's' : ''} attention` : 'Everything is working'}
        </p>
        <p className="text-sm text-ink-soft">Updates every 15 seconds. Setting values are never shown, only whether they’re present.</p>
      </div>
      <ul className="divide-y divide-line">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>
              {c.ok ? <CheckIcon className="h-3 w-3" /> : <span className="text-xs font-bold">!</span>}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{c.label}</p>
              <p className="text-sm text-ink-muted">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {run?.errors && run.errors.length > 0 && (
        <div className="border-t border-line px-5 py-4 sm:px-6">
          <p className="text-sm font-semibold text-bad">Last background run errors</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">
            {run.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
