'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { api, errorMessage } from '../../lib/api'
import { formatDateTime, timeAgo } from '../../lib/format'
import type { AdminBusiness, AdminOverview } from '../../lib/types'
import { Button } from '../../components/Button'
import { CheckIcon } from '../../components/Icons'
import { Drawer, inputClass } from '../../components/Overlay'
import { useToast } from '../../components/Toast'

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`

// ---------- One status per business ----------
// The single most important thing about an account, in priority order.

type Tone = 'attention' | 'review' | 'done' | 'muted' | 'stopped'

interface AccountState {
  key: 'suspended' | 'review' | 'rejected' | 'email' | 'no_cac' | 'active' | 'no_plan'
  label: string
  tone: Tone
}

export function accountState(b: AdminBusiness): AccountState {
  if (b.suspended) return { key: 'suspended', label: 'Suspended', tone: 'stopped' }
  if (b.verification.status === 'pending') return { key: 'review', label: 'CAC to review', tone: 'review' }
  if (b.verification.status === 'rejected') return { key: 'rejected', label: 'CAC rejected', tone: 'attention' }
  if (!b.emailVerified) return { key: 'email', label: 'Email not confirmed', tone: 'muted' }
  if (b.verification.status !== 'approved') return { key: 'no_cac', label: 'No CAC yet', tone: 'muted' }
  if (b.plan.active) return { key: 'active', label: b.plan.outOfCredits ? 'Out of calls' : 'Active', tone: b.plan.outOfCredits ? 'attention' : 'done' }
  return { key: 'no_plan', label: 'Verified, no plan', tone: 'muted' }
}

const TONE: Record<Tone, string> = {
  stopped: 'bg-bad text-white',
  attention: 'bg-bad-soft text-bad',
  review: 'bg-danfo-soft text-ink ring-1 ring-inset ring-danfo',
  done: 'bg-good-soft text-good',
  muted: 'bg-mist text-ink-soft',
}

function StateBadge({ business }: { business: AdminBusiness }) {
  const s = accountState(business)
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[s.tone]}`}>{s.label}</span>
}

function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink font-display text-sm font-bold text-danfo">{letters || '?'}</span>
}

function PlanSummary({ business }: { business: AdminBusiness }) {
  const p = business.plan
  if (!p.active) return <span className="text-ink-muted">{p.planName ? `${p.planName} ended` : 'No plan'}</span>
  return (
    <span>
      <span className="font-semibold text-ink">{p.planName}</span>
      <span className={p.outOfCredits ? 'text-bad' : 'text-ink-muted'}> · {p.callsLeft} calls left</span>
    </span>
  )
}

// ---------- List ----------

const FILTERS: { key: string; label: string; match: (b: AdminBusiness) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'review', label: 'To review', match: (b) => accountState(b).key === 'review' },
  { key: 'paying', label: 'Paying', match: (b) => !b.suspended && b.plan.active },
  { key: 'setup', label: 'Still setting up', match: (b) => ['email', 'no_cac', 'rejected', 'no_plan'].includes(accountState(b).key) },
  { key: 'suspended', label: 'Suspended', match: (b) => Boolean(b.suspended) },
]

export function BusinessesView({ overview, onChanged }: { overview: AdminOverview; onChanged: () => void }) {
  const accounts = useMemo(() => overview.businesses.filter((b) => !b.is_house), [overview.businesses])
  const [filter, setFilter] = useState(() => (accounts.some((b) => accountState(b).key === 'review') ? 'review' : 'all'))
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  const q = query.trim().toLowerCase()
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]
  const list = accounts
    .filter(active.match)
    .filter((b) => !q || [b.name, b.ownerName, b.email].some((v) => v?.toLowerCase().includes(q)))
  const open = accounts.find((b) => b.id === openId) ?? null

  const counts = {
    review: accounts.filter((b) => accountState(b).key === 'review').length,
    paying: accounts.filter((b) => !b.suspended && b.plan.active).length,
    suspended: accounts.filter((b) => b.suspended).length,
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
        <Summary label="Businesses" value={accounts.length} />
        <Summary label="Paying" value={counts.paying} />
        <Summary label="CAC to review" value={counts.review} highlight={counts.review > 0} onClick={() => setFilter('review')} />
        <Summary label="Suspended" value={counts.suspended} onClick={counts.suspended ? () => setFilter('suspended') : undefined} />
        <Summary label="Revenue, all time" value={naira(overview.revenue.totalNaira)} className="col-span-2 lg:col-span-1" />
      </div>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filter businesses">
            {FILTERS.map((f) => {
              const n = accounts.filter(f.match).length
              const selected = filter === f.key
              return (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(f.key)}
                  className={`btn flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                    selected ? 'bg-ink text-white' : 'text-ink-soft hover:bg-mist'
                  }`}
                >
                  {f.label}
                  <span className={`tabular-nums text-xs ${selected ? 'text-white/70' : f.key === 'review' && n > 0 ? 'text-ink' : 'text-ink-faint'}`}>{n}</span>
                </button>
              )
            })}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, owner or email"
            aria-label="Search businesses"
            className="w-full rounded-xl bg-paper px-3.5 py-2 text-[15px] text-ink ring-1 ring-inset ring-ink/10 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink sm:w-64"
          />
        </div>

        {list.length === 0 ? (
          <p className="px-5 py-14 text-center text-base text-ink-muted">
            {accounts.length === 0 ? 'No businesses have signed up yet.' : q ? `No business matches “${query.trim()}”.` : `Nothing in “${active.label}” right now.`}
          </p>
        ) : (
          <>
            {/* Phones: one card per business */}
            <ul className="divide-y divide-line md:hidden">
              {list.map((b) => (
                <li key={b.id}>
                  <button onClick={() => setOpenId(b.id)} className="flex w-full items-start gap-3 px-4 py-4 text-left active:bg-paper">
                    <Initials name={b.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate font-semibold text-ink">{b.name}</span>
                        <StateBadge business={b} />
                      </span>
                      <span className="block truncate text-sm text-ink-muted">{[b.ownerName, b.email].filter(Boolean).join(' · ')}</span>
                      <span className="mt-1.5 block text-sm">
                        <PlanSummary business={b} />
                        <span className="text-ink-muted"> · {b.usage.answeredThisMonth} calls this month</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[15px]">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="py-3 pl-5 pr-3">Business</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Plan</th>
                    <th className="px-3 py-3 text-right">Calls this month</th>
                    <th className="px-3 py-3 text-right">Paid you</th>
                    <th className="py-3 pl-3 pr-5 text-right">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b) => (
                    <tr key={b.id} onClick={() => setOpenId(b.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-paper">
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <Initials name={b.name} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-ink">{b.name}</div>
                            <div className="truncate text-sm text-ink-muted">{[b.ownerName, b.email].filter(Boolean).join(' · ')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StateBadge business={b} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm">
                        <PlanSummary business={b} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span className="text-ink">{b.usage.answeredThisMonth}</span>
                        <span className="block text-xs text-ink-muted">{b.usage.minutesThisMonth} min</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink">{naira(b.usage.revenueNaira)}</td>
                      <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right text-sm text-ink-muted">{timeAgo(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {open && <BusinessPanel key={open.id} business={open} plans={overview.plans} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </>
  )
}

function Summary({ label, value, highlight, onClick, className = '' }: { label: string; value: ReactNode; highlight?: boolean; onClick?: () => void; className?: string }) {
  const body = (
    <>
      <span className={`block text-[13px] font-semibold ${highlight ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
      <span className="mt-1 block font-display text-3xl font-bold tabular-nums text-ink">{value}</span>
    </>
  )
  const style = `rounded-3xl px-4 py-3.5 text-left ring-1 ${highlight ? 'bg-danfo-soft ring-danfo' : 'bg-white ring-ink/10'} ${className}`
  return onClick ? (
    <button onClick={onClick} className={`btn ${style}`}>
      {body}
    </button>
  ) : (
    <div className={style}>{body}</div>
  )
}

// ---------- Side panel: everything about one business ----------

function Section({ title, children, tone }: { title: string; children: ReactNode; tone?: 'danger' }) {
  return (
    <section className={`rounded-3xl p-4 ring-1 sm:p-5 ${tone === 'danger' ? 'bg-white ring-bad/25' : 'bg-white ring-ink/10'}`}>
      <h3 className={`text-sm font-semibold uppercase tracking-wide ${tone === 'danger' ? 'text-bad' : 'text-ink-muted'}`}>{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-[15px] tabular-nums text-ink">{value}</dd>
    </div>
  )
}

function BusinessPanel({
  business,
  plans,
  onClose,
  onChanged,
}: {
  business: AdminBusiness
  plans: AdminOverview['plans']
  onClose: () => void
  onChanged: () => void
}) {
  const b = business
  return (
    <Drawer onClose={onClose}>
      <div className="flex flex-col gap-4 p-4 pt-5 sm:p-8">
        <header className="flex items-start gap-3 pr-12">
          <Initials name={b.name} />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{b.name}</h2>
            <p className="mt-0.5 text-[15px] text-ink-soft">
              {b.ownerName ?? 'Owner not given'} · {b.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <StateBadge business={b} />
              <span>Joined {formatDateTime(b.created_at)}</span>
              <span className="inline-flex items-center gap-1">
                {b.emailVerified ? <CheckIcon className="h-3.5 w-3.5 text-good" /> : null}
                {b.emailVerified ? 'Email confirmed' : 'Email not confirmed'}
              </span>
            </div>
          </div>
        </header>

        <Section title="CAC verification">
          <Verification business={b} onChanged={onChanged} />
        </Section>

        <Section title="Plan and calls">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Fact label="Plan" value={<PlanSummary business={b} />} />
            <Fact label="Renews or ends" value={b.plan.expiresAt ? formatDateTime(b.plan.expiresAt) : '—'} />
            <Fact label="Paid you, all time" value={naira(b.usage.revenueNaira)} />
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="text-sm text-ink-muted">Switch a plan on by hand (demos, bank transfers):</span>
            <PlanSwitch business={b} plans={plans} onChanged={onChanged} />
          </div>
        </Section>

        <Section title="This month">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label="Answered calls" value={b.usage.answeredThisMonth} />
            <Fact label="Minutes" value={b.usage.minutesThisMonth} />
            <Fact label="Costs you ≈" value={naira(b.usage.costThisMonthNaira)} />
            <Fact label="All-time" value={`${b.customers} customers · ${b.orders} orders · ${b.calls} calls`} />
          </dl>
        </Section>

        <Section title="Danger zone" tone="danger">
          <DangerZone business={b} onChanged={onChanged} onDeleted={onClose} />
        </Section>
      </div>
    </Drawer>
  )
}

function Verification({ business, onChanged }: { business: AdminBusiness; onChanged: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<'view' | 'approve' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const v = business.verification

  const view = async () => {
    setBusy('view')
    try {
      window.open(await api.adminDocument(business.id), '_blank', 'noopener')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }
  const decide = async (status: 'approved' | 'rejected') => {
    if (status === 'rejected' && reason.trim().length < 5) return toast.error('Say why, so the business knows what to fix.')
    setBusy(status === 'approved' ? 'approve' : 'reject')
    try {
      await api.adminSetVerification(business.id, status, status === 'rejected' ? reason.trim() : undefined)
      toast.success(status === 'approved' ? `${business.name} approved and emailed` : `${business.name} asked to upload again`)
      setRejecting(false)
      setReason('')
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  if (!v.document) {
    return <p className="text-[15px] text-ink-muted">{business.emailVerified ? 'They haven’t uploaded a certificate yet.' : 'They need to confirm their email before uploading.'}</p>
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{v.document.filename}</p>
          <p className="text-sm text-ink-muted">
            Uploaded {formatDateTime(v.document.uploadedAt)} · {Math.max(1, Math.round(v.document.sizeBytes / 1024))} KB
          </p>
        </div>
        <Button size="sm" variant="secondary" loading={busy === 'view'} onClick={view}>
          Open certificate
        </Button>
      </div>
      {v.status === 'approved' && <p className="text-[15px] text-good">Approved{v.updatedAt ? ` on ${formatDateTime(v.updatedAt)}` : ''}.</p>}
      {v.status === 'rejected' && v.note && <p className="text-[15px] text-bad">Rejected: {v.note}</p>}
      {v.status !== 'approved' && !rejecting && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => decide('approved')} loading={busy === 'approve'} disabled={busy !== null} icon={<CheckIcon className="h-4 w-4" />}>
            Approve business
          </Button>
          <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
            Reject
          </Button>
        </div>
      )}
      {rejecting && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-soft" htmlFor="reject-reason">
            Why? They’ll see this in the email.
          </label>
          <input
            id="reject-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The certificate is blurry, or the name doesn’t match"
            className={inputClass}
          />
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => decide('rejected')} loading={busy === 'reject'}>
              Reject and email
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanSwitch({ business, plans, onChanged }: { business: AdminBusiness; plans: AdminOverview['plans']; onChanged: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
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

function DangerZone({ business, onChanged, onDeleted }: { business: AdminBusiness; onChanged: () => void; onDeleted: () => void }) {
  const toast = useToast()
  const [mode, setMode] = useState<'idle' | 'suspending' | 'deleting'>('idle')
  const [reason, setReason] = useState('')
  const [confirmName, setConfirmName] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>, done: string, after?: () => void) => {
    setBusy(true)
    try {
      await action()
      toast.success(done)
      setMode('idle')
      setReason('')
      setConfirmName('')
      onChanged()
      after?.()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const nameMatches = confirmName.trim().toLowerCase() === business.name.trim().toLowerCase()

  if (!business.suspended) {
    return mode === 'suspending' ? (
      <div className="flex flex-col gap-2">
        <p className="text-[15px] text-ink-soft">They’re signed out, calls stop straight away, and we email them. Nothing is deleted, and you can undo it.</p>
        <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (only you see this), optional" className={inputClass} />
        <div className="flex gap-2">
          <Button variant="danger" loading={busy} onClick={() => run(() => api.adminSuspend(business.id, reason.trim() || undefined), `${business.name} suspended`)}>
            Suspend now
          </Button>
          <Button variant="ghost" onClick={() => setMode('idle')}>
            Cancel
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-ink-soft">Suspend to block log-in and calls. To delete an account, suspend it first.</p>
        <Button variant="secondary" onClick={() => setMode('suspending')}>
          Suspend account
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-ink-soft">
        <span className="font-semibold text-bad">Suspended</span> since {formatDateTime(business.suspended.at)}
        {business.suspended.reason ? ` · ${business.suspended.reason}` : ''}
      </p>
      {mode !== 'deleting' ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy} onClick={() => run(() => api.adminUnsuspend(business.id), `${business.name} can log in again`)}>
            Lift suspension
          </Button>
          <Button variant="ghost" className="text-bad" onClick={() => setMode('deleting')}>
            Delete permanently…
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl bg-bad-soft p-4">
          <p className="font-semibold text-bad">Delete {business.name} forever?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Removes the account, log-in, CAC certificate, {business.customers} customers, {business.orders} orders and {business.calls} calls, and erases the name and
            email from its payments (amounts stay in your revenue total). We’ll email {business.email} to confirm. This can’t be undone.
          </p>
          <label className="mt-3 block text-sm font-semibold text-ink-soft">
            Type <span className="text-ink">{business.name}</span> to confirm
            <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoFocus className={`${inputClass} mt-1.5`} />
          </label>
          <div className="mt-3 flex gap-2">
            <Button
              variant="danger"
              disabled={!nameMatches}
              loading={busy}
              onClick={() => run(() => api.adminDeleteBusiness(business.id, confirmName), `${business.name} deleted`, onDeleted)}
            >
              Delete forever
            </Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
