'use client'

import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'
import { useBusiness } from '../hooks/useBusiness'
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
import { CheckIcon, PhoneIcon, PlusIcon, UploadIcon } from '../components/Icons'
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

function NextCallCell({ order, now, canCall = true }: { order: OrderRow; now: Date; canCall?: boolean }) {
  if (order.status === 'calling') {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-base font-semibold text-ink">
        <Spinner className="h-4 w-4" /> On the phone now
      </span>
    )
  }
  // Due, but the business has no plan or credits: the call is held, not lost.
  if (isWaiting(order) && !canCall && (parseDate(order.call_at)?.getTime() ?? 0) <= now.getTime()) {
    return (
      <Link href="/dashboard/billing" onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-bad underline-offset-4 hover:underline">
        Waiting for call credits · top up
      </Link>
    )
  }
  if (isWaiting(order)) {
    const retry = (order.attempts ?? 0) > 0
    return (
      <div>
        <div className="whitespace-nowrap text-base font-semibold text-ink">{friendlyWhen(order.call_at, now)}</div>
        <div className="text-sm text-ink-muted">{countdown(order.call_at, now)}</div>
        {retry && <div className="text-sm font-semibold text-ink-soft">No answer · retry {order.attempts + 1} of {MAX_ATTEMPTS}</div>}
      </div>
    )
  }
  if (['no_answer', 'failed'].includes(order.status)) {
    return <span className="text-sm font-semibold text-bad">Needs you: no more retries</span>
  }
  if (WAITING.includes(order.status)) {
    return <span className="text-sm text-ink-faint">Not scheduled</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-good">
      <CheckIcon className="h-3.5 w-3.5" />
      Done
    </span>
  )
}

export function OrdersPage() {
  const now = useNow()
  const { data: rawOrders, error, loading, refresh } = usePolling(api.listOrders, 'orders')
  const { business } = useBusiness()
  const canCall = business ? business.plan.active && !business.plan.outOfCredits : true
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
        subtitle="Add an order and pick when Tellero AI should call. Everything after that happens on its own."
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
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            <StatCard label="Calls scheduled" value={upcoming.length} />
            <StatCard label="On the phone now" value={count('calling')} marker="live" />
            <StatCard label="Confirmed" value={count('confirmed')} />
            <StatCard label="New time / address" value={count('rescheduled', 'address_updated')} />
            <StatCard label="Need your attention" value={count('no_answer', 'failed')} marker="attention" className="col-span-2 sm:col-span-1" />
          </div>
          {next && (
            <div className="mb-6 flex items-start gap-3 rounded-3xl bg-ink px-4 py-3.5 text-[15px] text-white sm:items-center sm:rounded-[28px] sm:px-5 sm:py-4 sm:text-base">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danfo text-ink">
                <PhoneIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                Next Tellero AI call: <span className="font-bold">{next.customer_name}</span> about {next.item},{' '}
                {canCall ? (
                  <>
                    <span className="font-bold">{friendlyWhen(next.call_at, now)}</span> ({countdown(next.call_at, now)})
                  </>
                ) : (
                  <span className="font-bold text-danfo">waiting for call credits</span>
                )}
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
                hint="Add an order, pick the delivery time, and Tellero AI will call the customer at the right moment."
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
              <>
              {/* Phones: one card per order, same information as the table row */}
              <ul className="divide-y divide-line lg:hidden">
                {orders.map((o) => (
                  <li key={o.id} className={o.status === 'calling' ? 'animate-row-pulse' : changed.has(o.id) && !added.has(o.id) ? 'animate-flash' : ''}>
                    <button onClick={() => setOpenId(o.id)} className="flex w-full flex-col gap-2.5 px-4 py-4 text-left active:bg-paper">
                      <div className="flex w-full items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-ink">{o.customer_name}</div>
                          <div className="text-sm tabular-nums text-ink-muted">{formatPhone(o.customer_phone)}</div>
                        </div>
                        <StatusBadge status={o.status} size="sm" />
                      </div>
                      <div className="min-w-0 text-[15px] text-ink">
                        {o.item}
                        <span className="block truncate text-sm text-ink-muted">
                          {o.rider_name ? `Rider: ${o.rider_name} · ` : ''}{o.cleaned_address || o.address_on_file || 'no address'}
                        </span>
                      </div>
                      <div className="flex w-full flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-2xl bg-paper px-3 py-2.5">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Delivery</div>
                          <div className="text-sm text-ink-soft">{o.delivery_window || (o.delivery_at ? friendlyWhen(o.delivery_at, now) : '—')}</div>
                        </div>
                        <div className="text-right [&_*]:text-sm">
                          <NextCallCell order={o} now={now} canCall={canCall} />
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-ink/15 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-4">Customer</th>
                      <th className="px-3 py-4">Order</th>
                      <th className="px-3 py-4">Delivery</th>
                      <th className="px-3 py-4">Status</th>
                      <th className="px-4 py-4">Tellero AI call</th>
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
                          className={`cursor-pointer border-b border-line last:border-0 hover:bg-paper ${rowAnim}`}
                        >
                          <td className="px-4 py-4">
                            <div className="text-base font-semibold">{o.customer_name}</div>
                            <div className="whitespace-nowrap text-sm tabular-nums text-ink-muted">{formatPhone(o.customer_phone)}</div>
                          </td>
                          <td className="max-w-[220px] px-3 py-4">
                            <div className="text-base">{o.item}</div>
                            <div className="truncate text-sm text-ink-muted" title={o.cleaned_address || o.address_on_file || ''}>
                              {o.rider_name ? `Rider: ${o.rider_name} · ` : ''}{o.cleaned_address || o.address_on_file || 'no address'}
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <div className="min-w-[110px] text-base text-ink-soft">{o.delivery_window || (o.delivery_at ? friendlyWhen(o.delivery_at, now) : '—')}</div>
                          </td>
                          <td className="px-3 py-4">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="px-4 py-4">
                            <NextCallCell order={o} now={now} canCall={canCall} />
                          </td>
                        </motion.tr>
                      )
                    })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
          {orders && orders.length > 0 && (
            <p className="mt-3 text-sm text-ink-muted">Tap any order to see the call transcript, or to call the customer right now.</p>
          )}
        </section>

        <aside className="hidden xl:block">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danfo" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ink" />
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
