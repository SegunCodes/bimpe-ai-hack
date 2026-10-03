'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { api } from '../lib/api'
import { parseDate } from '../lib/format'
import { formatPhone } from '../lib/phone'
import { MAX_ATTEMPTS, countdown, friendlyWhen, useNow } from '../lib/schedule'
import type { OrderRow } from '../lib/types'
import { usePolling } from '../hooks/usePolling'
import { useChangedIds } from '../hooks/useChangedIds'
import { Button } from '../components/Button'
import { PageHeader, StatCard } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState, Spinner, StaleBanner } from '../components/States'
import { PhoneIcon, PlusIcon, UploadIcon } from '../components/Icons'
import { LiveFeed } from '../components/LiveFeed'
import { EASE_OUT } from '../components/Overlay'
import { AddOrderModal } from './AddOrderModal'
import { ImportCsvModal } from './ImportCsvModal'
import { OrderDrawer } from './OrderDrawer'

const WAITING = ['scheduled', 'pending']

/** An order is waiting for the AI if it has a planned call that hasn't happened yet. */
const isWaiting = (o: OrderRow) => WAITING.includes(o.status) && !!o.call_at

/** On the phone first, then upcoming calls (soonest first), then finished orders (latest first). */
function sortOrders(orders: OrderRow[]): OrderRow[] {
  const rank = (o: OrderRow) => (o.status === 'calling' ? 0 : isWaiting(o) ? 1 : 2)
  const time = (v: string | null) => parseDate(v)?.getTime() ?? 0
  return [...orders].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r) return r
    if (rank(a) === 1) return time(a.call_at) - time(b.call_at)
    return time(b.updated_at) - time(a.updated_at)
  })
}

function NextCallCell({ order, now }: { order: OrderRow; now: Date }) {
  if (order.status === 'calling') {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-base font-semibold text-blue-700">
        <Spinner className="h-4 w-4" /> On the phone now
      </span>
    )
  }
  if (isWaiting(order)) {
    const retry = (order.attempts ?? 0) > 0
    return (
      <div>
        <div className="whitespace-nowrap text-base font-semibold text-slate-900">{friendlyWhen(order.call_at, now)}</div>
        <div className="text-sm text-slate-500">{countdown(order.call_at, now)}</div>
        {retry && <div className="text-sm font-semibold text-orange-600">No answer, retry {order.attempts + 1} of {MAX_ATTEMPTS}</div>}
      </div>
    )
  }
  if (['no_answer', 'failed'].includes(order.status)) {
    return <span className="text-sm font-semibold text-red-600">Needs you: no more retries</span>
  }
  if (WAITING.includes(order.status)) {
    return <span className="text-sm text-slate-400">Not scheduled</span>
  }
  return <span className="text-sm font-semibold text-emerald-700">✓ Done</span>
}

export function OrdersPage() {
  const now = useNow()
  const { data: rawOrders, error, loading, refresh } = usePolling(api.listOrders, 'orders')
  const orders = rawOrders ? sortOrders(rawOrders) : null
  const { added, changed } = useChangedIds(rawOrders)
  const [modal, setModal] = useState<'add' | 'import' | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  const count = (...statuses: string[]) => orders?.filter((o) => statuses.includes(o.status)).length ?? 0
  const upcoming = orders?.filter(isWaiting) ?? []
  const next = upcoming[0]

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Add an order and pick when Tellero should call. Everything after that happens on its own."
        actions={
          <>
            <Button variant="secondary" onClick={() => setModal('import')} icon={<UploadIcon />}>
              Import CSV
            </Button>
            <Button variant="brand" onClick={() => setModal('add')} icon={<PlusIcon />}>
              Add order
            </Button>
          </>
        }
      />

      {orders && orders.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Calls scheduled" value={upcoming.length} tone="text-indigo-600" />
            <StatCard label="On the phone now" value={count('calling')} tone="text-blue-600" />
            <StatCard label="Confirmed" value={count('confirmed')} tone="text-emerald-600" />
            <StatCard label="Rescheduled / new address" value={count('rescheduled', 'address_updated')} tone="text-amber-600" />
            <StatCard label="Need your attention" value={count('no_answer', 'failed')} tone="text-red-600" />
          </div>
          {next && (
            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[28px] bg-ink px-5 py-4 text-base text-white">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danfo text-ink">
                <PhoneIcon className="h-4 w-4" />
              </span>
              <span>
                Next Tellero call: <span className="font-bold">{next.customer_name}</span> about {next.item},{' '}
                <span className="font-bold">{friendlyWhen(next.call_at, now)}</span> ({countdown(next.call_at, now)})
              </span>
            </div>
          )}
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          {error && orders && <StaleBanner message={error} />}
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
            {loading && !orders ? (
              <LoadingState label="Loading orders…" />
            ) : error && !orders ? (
              <ErrorState message={error} onRetry={refresh} />
            ) : !orders || orders.length === 0 ? (
              <EmptyState
                title="No orders yet"
                hint="Add an order, pick the delivery time, and Tellero will call the customer at the right moment."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setModal('add')} icon={<PlusIcon />}>
                      Add order
                    </Button>
                    <Button variant="secondary" onClick={() => setModal('import')} icon={<UploadIcon />}>
                      Import CSV
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-4">Customer</th>
                      <th className="px-4 py-4">Order</th>
                      <th className="px-4 py-4">Delivery</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-5 py-4">Tellero call</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                    {orders.map((o) => {
                      const rowAnim = o.status === 'calling' ? 'animate-row-pulse' : changed.has(o.id) && !added.has(o.id) ? 'animate-flash' : ''
                      return (
                        <motion.tr
                          key={o.id}
                          // New rows fade in. Re-sorts snap (no sliding while people read the table); the flash marks changes.
                          initial={{ opacity: 0, transform: 'translateY(-8px)' }}
                          animate={{ opacity: 1, transform: 'translateY(0px)' }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE_OUT }}
                          onClick={() => setOpenId(o.id)}
                          className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${rowAnim}`}
                        >
                          <td className="px-5 py-4">
                            <div className="text-base font-semibold">{o.customer_name}</div>
                            <div className="whitespace-nowrap text-sm tabular-nums text-slate-500">{formatPhone(o.customer_phone)}</div>
                          </td>
                          <td className="max-w-[240px] px-4 py-4">
                            <div className="text-base">{o.item}</div>
                            <div className="truncate text-sm text-slate-500" title={o.cleaned_address || o.address_on_file || ''}>
                              {o.seller} · {o.cleaned_address || o.address_on_file || 'no address'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="whitespace-nowrap text-base text-slate-700">{o.delivery_window || (o.delivery_at ? friendlyWhen(o.delivery_at, now) : '—')}</div>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="px-5 py-4">
                            <NextCallCell order={o} now={now} />
                          </td>
                        </motion.tr>
                      )
                    })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {orders && orders.length > 0 && (
            <p className="mt-3 text-sm text-slate-500">Click any order to see the call transcript, or to call the customer right now.</p>
          )}
        </section>

        <aside className="hidden xl:block">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            Live calls
          </h2>
          <LiveFeed compact limit={8} />
        </aside>
      </div>

      <AnimatePresence>
        {modal === 'add' && <AddOrderModal key="add" onClose={() => setModal(null)} onCreated={refresh} />}
        {modal === 'import' && <ImportCsvModal key="import" onClose={() => setModal(null)} onImported={refresh} />}
        {openId !== null && <OrderDrawer key={`order-${openId}`} id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
      </AnimatePresence>
    </>
  )
}
