import { useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatDateTime, newestFirst } from '../lib/format'
import { formatPhone } from '../lib/phone'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { CallHistory, InfoItem } from '../components/CallCard'
import { Drawer } from '../components/Overlay'
import { StatusBadge } from '../components/StatusBadge'
import { ErrorState, LoadingState, StaleBanner } from '../components/States'
import { PhoneIcon } from '../components/Icons'

export function OrderDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const { data: order, error, loading, refresh } = usePolling(() => api.getOrder(id), `order-${id}`)
  const [starting, setStarting] = useState(false)

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
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{order.item}</h2>
            <p className="mt-1 text-lg text-slate-600">
              for <span className="font-semibold text-slate-900">{order.customer_name}</span> · {formatPhone(order.customer_phone)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge status={order.status} size="lg" />
              <Button onClick={call} loading={starting} disabled={order.status === 'calling'}>
                <PhoneIcon /> {order.status === 'calling' ? 'Calling…' : 'Call now'}
              </Button>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Address on file</h3>
              <p className="mt-2 text-lg text-slate-700">{order.address_on_file || '—'}</p>
            </div>
            <div className="rounded-3xl bg-accent-50 p-5 ring-1 ring-accent-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-accent-700">Cleaned by AI</h3>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {order.cleaned_address || <span className="font-normal text-slate-400">Not confirmed yet</span>}
              </p>
              {order.landmark && <p className="mt-2 text-base text-slate-600">📍 Landmark: {order.landmark}</p>}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <InfoItem label="Seller" value={order.seller} />
              <InfoItem label="Delivery window" value={order.delivery_window} />
              <InfoItem label="Latest outcome" value={order.calls?.length ? <StatusBadge status={newestFirst(order.calls)[0].outcome} /> : null} />
              <InfoItem label="Reschedule time" value={order.reschedule_time ? formatDateTime(order.reschedule_time) : null} />
              <InfoItem label="Attempts" value={String(order.attempts ?? 0)} />
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
