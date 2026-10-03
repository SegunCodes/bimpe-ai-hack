'use client'

import { useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatDateTime, newestFirst } from '../lib/format'
import { formatPhone } from '../lib/phone'
import type { OrderDetail } from '../lib/types'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { CallHistory, InfoItem } from '../components/CallCard'
import { Drawer } from '../components/Overlay'
import { StatusBadge } from '../components/StatusBadge'
import { ErrorState, LoadingState, StaleBanner } from '../components/States'
import { PhoneIcon } from '../components/Icons'
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
        <div className="flex flex-col gap-6 p-5 sm:p-8">
          {error && <StaleBanner message={error} />}
          <header className="pr-12">
            <p className="text-sm font-semibold text-slate-500">Order #{order.id}</p>
            <h2 className="mt-1 font-display text-4xl font-bold tracking-[-0.02em] text-ink">{order.item}</h2>
            <p className="mt-1 text-lg text-slate-600">
              for <span className="font-semibold text-slate-900">{order.customer_name}</span> · {formatPhone(order.customer_phone)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge status={order.status} size="lg" />
            </div>
          </header>

          <ScheduleCard order={order} now={now} onCallNow={call} starting={starting} />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 ring-1 ring-ink/10">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Address on file</h3>
              <p className="mt-2 text-lg text-slate-700">{order.address_on_file || '—'}</p>
            </div>
            <div className="rounded-[28px] bg-danfo-soft p-5 ring-1 ring-danfo/50">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">Cleaned by Tellero</h3>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {order.cleaned_address || <span className="font-normal text-slate-400">Not confirmed yet</span>}
              </p>
              {order.landmark && <p className="mt-2 text-base text-slate-600">📍 Landmark: {order.landmark}</p>}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 ring-1 ring-ink/10 sm:p-6">
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
    <section className="flex flex-wrap items-center gap-4 rounded-[28px] bg-ink p-5 text-white">
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-danfo">Tellero call</h3>
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
      <Button variant="secondary" size="sm" onClick={onCallNow} loading={starting} disabled={calling} icon={<PhoneIcon className="h-4 w-4" />}>
        {waiting ? 'Call now instead' : 'Call now'}
      </Button>
    </section>
  )
}
