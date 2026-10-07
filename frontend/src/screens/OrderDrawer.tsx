'use client'

import { useEffect, useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatDateTime, isActiveCall, newestFirst, timeAgo } from '../lib/format'
import { formatPhone } from '../lib/phone'
import type { OrderDetail, Rider } from '../lib/types'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { CallHistory, InfoItem } from '../components/CallCard'
import { Drawer, inputClass } from '../components/Overlay'
import { StatusBadge } from '../components/StatusBadge'
import { ErrorState, LoadingState, StaleBanner } from '../components/States'
import { BikeIcon, PhoneIcon, PinIcon } from '../components/Icons'
import { MAX_ATTEMPTS, countdown, friendlyWhen, planLabel, useNow } from '../lib/schedule'

export function OrderDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const { data: order, error, loading, refresh } = usePolling(() => api.getOrder(id), `order-${id}`)
  const [starting, setStarting] = useState(false)
  const now = useNow()

  const call = async () => {
    if (!order) return
    setStarting(true)
    try {
      await api.callOrder(order.id)
      toast.success(`Calling ${order.customer_name}…`)
      refresh()
      onChanged()
    } catch (err) {
      toast.error(`Couldn't start the call: ${errorMessage(err)}`)
    } finally {
      setStarting(false)
    }
  }

  return (
    <Drawer onClose={onClose}>
      {loading && !order && <LoadingState label="Loading order…" />}
      {error && !order && <ErrorState message={error} onRetry={refresh} />}
      {order && (
        <div className="flex flex-col gap-5 p-4 pt-5 sm:gap-6 sm:p-8">
          {error && <StaleBanner message={error} />}
          <header className="pr-12">
            <p className="text-sm font-semibold text-ink-muted">Order #{order.id}</p>
            <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl tracking-[-0.02em] text-ink">{order.item}</h2>
            <p className="mt-1 text-base sm:text-lg text-ink-soft">
              for <span className="font-semibold text-ink">{order.customer_name}</span> · {formatPhone(order.customer_phone)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge status={order.status} size="lg" />
            </div>
          </header>

          <ScheduleCard order={order} now={now} onCallNow={call} starting={starting} />

          <RiderCard order={order} onChanged={() => { refresh(); onChanged() }} />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-4 ring-1 ring-ink/10 sm:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Address on file</h3>
              <p className="mt-2 text-base text-ink-soft sm:text-lg">{order.address_on_file || '—'}</p>
            </div>
            <div className="rounded-3xl bg-danfo-soft p-4 ring-1 ring-danfo/50 sm:rounded-[28px] sm:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">Cleaned by Tellero AI</h3>
              <p className="mt-2 text-base font-semibold text-ink sm:text-lg">
                {order.cleaned_address || <span className="font-normal text-ink-faint">Not confirmed yet</span>}
              </p>
              {order.landmark && (
                <p className="mt-2 flex items-start gap-1.5 text-base text-ink-soft">
                  <PinIcon className="mt-1 h-4 w-4 shrink-0" />
                  Landmark: {order.landmark}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/10 sm:p-6">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <InfoItem label="Seller" value={order.seller} />
              <InfoItem label="Delivery" value={order.delivery_window || (order.delivery_at ? friendlyWhen(order.delivery_at, now) : null)} />
              <InfoItem label="Latest outcome" value={order.calls?.length ? <StatusBadge status={newestFirst(order.calls)[0].outcome} /> : null} />
              <InfoItem label="Reschedule time" value={order.reschedule_time ? formatDateTime(order.reschedule_time) : null} />
              <InfoItem label="Attempts" value={`${order.attempts ?? 0} of ${MAX_ATTEMPTS}`} />
              <InfoItem label="Landmark" value={order.landmark} />
              <InfoItem label="Outcome notes" value={order.outcome_notes} wide />
            </dl>
          </section>

          <CallHistory calls={newestFirst(order.calls ?? [])} />
        </div>
      )}
    </Drawer>
  )
}

function ScheduleCard({
  order,
  now,
  onCallNow,
  starting,
}: {
  order: OrderDetail
  now: Date
  onCallNow: () => void
  starting: boolean
}) {
  const calling = order.status === 'calling'
  const waiting = ['scheduled', 'pending'].includes(order.status) && !!order.call_at
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-ink p-5 text-white sm:flex-row sm:items-center sm:rounded-[28px]">
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-danfo">Tellero AI call</h3>
        {calling ? (
          <p className="mt-1 text-xl font-bold text-white">On the phone right now…</p>
        ) : waiting ? (
          <>
            <p className="mt-1 text-xl font-bold text-white">
              {friendlyWhen(order.call_at, now)} <span className="text-base font-medium text-white/60">({countdown(order.call_at, now)})</span>
            </p>
            <p className="text-sm text-white/70">
              {order.attempts > 0 ? `Retry ${order.attempts + 1} of ${MAX_ATTEMPTS} after no answer` : `Rule: ${planLabel(order.call_plan)}`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-base text-white/80">
            {['no_answer', 'failed'].includes(order.status)
              ? `The AI tried ${order.attempts} time${order.attempts === 1 ? '' : 's'} and couldn't reach the customer.`
              : order.call_plan
                ? `Finished. Rule was: ${planLabel(order.call_plan)}`
                : 'No call scheduled.'}
          </p>
        )}
      </div>
      <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={onCallNow} loading={starting} disabled={calling} icon={<PhoneIcon className="h-4 w-4" />}>
        {waiting ? 'Call now instead' : 'Call now'}
      </Button>
    </section>
  )
}

const CONFIRMED = ['confirmed', 'address_updated', 'rescheduled']

/** Who carries this order, and whether they have the confirmed details yet. */
function RiderCard({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const toast = useToast()
  const [riders, setRiders] = useState<Rider[] | null>(null)
  const [changing, setChanging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [calling, setCalling] = useState(false)

  useEffect(() => {
    api.listRiders().then(setRiders).catch(() => setRiders([]))
  }, [])

  const assign = async (value: string) => {
    setSaving(true)
    try {
      await api.setOrderRider(order.id, value ? Number(value) : null)
      setChanging(false)
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const callRider = async () => {
    setCalling(true)
    try {
      await api.callRider(order.id)
      toast.success(`Calling ${order.rider_name}…`)
      onChanged()
    } catch (err) {
      toast.error(`Couldn't call the rider: ${errorMessage(err)}`)
    } finally {
      setCalling(false)
    }
  }

  const link = order.rider_link ? `${window.location.origin}${order.rider_link}` : null
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Rider link copied')
    } catch {
      toast.error('Couldn’t copy. Long-press the WhatsApp button instead.')
    }
  }
  const whatsapp =
    link && order.rider_phone
      ? `https://wa.me/${order.rider_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
          `Hi ${order.rider_name?.split(' ')[0] ?? ''}, delivery for ${order.customer_name} (${order.item}). Address, landmark and time: ${link}`
        )}`
      : null

  const latest = order.rider_calls?.[0]
  const confirmed = CONFIRMED.includes(order.status)
  let status: string
  if (!latest) status = confirmed ? 'The customer has confirmed. Call the rider or send them the link.' : `Gets the details once ${order.customer_name.split(' ')[0]} confirms.`
  else if (isActiveCall(latest.status)) status = `On the phone with ${order.rider_name} now…`
  else if (latest.outcome === 'briefed') status = `Briefed by Tellero AI ${timeAgo(latest.created_at)}.`
  else if (latest.outcome === 'no_answer') status = `${order.rider_name} didn’t pick up. Send them the link instead.`
  else status = 'The rider call didn’t go through. Send them the link instead.'

  const picker = (
    <select
      className={inputClass}
      value={order.rider_id ?? ''}
      onChange={(e) => assign(e.target.value)}
      disabled={saving || riders === null}
      aria-label="Rider for this order"
    >
      <option value="">{riders === null ? 'Loading riders…' : 'No rider'}</option>
      {riders?.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name} · {formatPhone(r.phone)}
        </option>
      ))}
    </select>
  )

  return (
    <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/10 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danfo-soft text-ink">
          <BikeIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Rider</h3>
          {order.rider_id && !changing ? (
            <>
              <p className="mt-0.5 truncate text-lg font-bold text-ink">{order.rider_name}</p>
              <p className="text-sm text-ink-muted">{formatPhone(order.rider_phone)}</p>
              <p className="mt-0.5 text-[15px] text-ink-soft">{status}</p>
            </>
          ) : (
            <div className="mt-1.5">
              {riders?.length === 0 ? (
                <p className="text-[15px] text-ink-soft">
                  No riders yet. Add them in{' '}
                  <a href="/dashboard/settings" className="font-semibold text-ink underline underline-offset-4">
                    Settings
                  </a>
                  .
                </p>
              ) : (
                picker
              )}
            </div>
          )}
        </div>
        {order.rider_id && !changing && (
          <Button variant="ghost" size="sm" onClick={() => setChanging(true)}>
            Change
          </Button>
        )}
      </div>

      {order.rider_id && !changing && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {confirmed && (
            <Button
              size="sm"
              onClick={callRider}
              loading={calling}
              disabled={latest ? isActiveCall(latest.status) : false}
              icon={<PhoneIcon className="h-4 w-4" />}
            >
              {latest ? 'Call rider again' : 'Call rider'}
            </Button>
          )}
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-secondary inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-ink">
              Send on WhatsApp
            </a>
          )}
          <Button variant="secondary" size="sm" onClick={copy}>
            Copy rider link
          </Button>
        </div>
      )}
      {changing && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setChanging(false)}>
            Cancel
          </Button>
        </div>
      )}
    </section>
  )
}
