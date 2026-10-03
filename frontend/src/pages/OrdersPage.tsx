import { useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatPhone } from '../lib/phone'
import type { OrderRow } from '../lib/types'
import { usePolling } from '../hooks/usePolling'
import { useChangedIds } from '../hooks/useChangedIds'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { PageHeader, StatCard } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState, Spinner, StaleBanner } from '../components/States'
import { PhoneIcon, PlusIcon, UploadIcon } from '../components/Icons'
import { LiveFeed } from '../components/LiveFeed'
import { AddOrderModal } from './AddOrderModal'
import { ImportCsvModal } from './ImportCsvModal'
import { OrderDrawer } from './OrderDrawer'

export function OrdersPage() {
  const toast = useToast()
  const { data: orders, error, loading, refresh } = usePolling(api.listOrders, 'orders')
  const { added, changed } = useChangedIds(orders)
  const [starting, setStarting] = useState<Set<number>>(new Set())
  const [callingAll, setCallingAll] = useState(false)
  const [modal, setModal] = useState<'add' | 'import' | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  const callOrder = async (order: OrderRow) => {
    setStarting((s) => new Set(s).add(order.id))
    try {
      await api.callOrder(order.id)
      toast.success(`Calling ${order.customer_name}…`)
      await refresh()
    } catch (err) {
      toast.error(`Couldn't call ${order.customer_name}: ${errorMessage(err)}`)
    } finally {
      setStarting((s) => {
        const next = new Set(s)
        next.delete(order.id)
        return next
      })
    }
  }

  const callAllPending = async () => {
    setCallingAll(true)
    try {
      const { started } = await api.callAllPending()
      if (started > 0) toast.success(`Started ${started} call${started === 1 ? '' : 's'}`)
      else toast.info('No pending orders to call')
      await refresh()
    } catch (err) {
      toast.error(`Couldn't start calls: ${errorMessage(err)}`)
    } finally {
      setCallingAll(false)
    }
  }

  const count = (...statuses: string[]) => orders?.filter((o) => statuses.includes(o.status)).length ?? 0
  const pendingCount = count('pending')

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Deliveries waiting for the AI to confirm with the customer."
        actions={
          <>
            <Button variant="secondary" onClick={() => setModal('import')}>
              <UploadIcon /> Import CSV
            </Button>
            <Button variant="secondary" onClick={() => setModal('add')}>
              <PlusIcon /> Add order
            </Button>
            <Button onClick={callAllPending} loading={callingAll} disabled={!orders || pendingCount === 0}>
              <PhoneIcon /> Call all pending{pendingCount > 0 && ` (${pendingCount})`}
            </Button>
          </>
        }
      />

      {orders && orders.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Pending" value={pendingCount} />
          <StatCard label="Calling now" value={count('calling')} tone="text-blue-600" />
          <StatCard label="Confirmed" value={count('confirmed')} tone="text-emerald-600" />
          <StatCard label="Rescheduled / new address" value={count('rescheduled', 'address_updated')} tone="text-amber-600" />
          <StatCard label="Need follow-up" value={count('no_answer', 'failed')} tone="text-red-600" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          {error && orders && <StaleBanner message={error} />}
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            {loading && !orders ? (
              <LoadingState label="Loading orders…" />
            ) : error && !orders ? (
              <ErrorState message={error} onRetry={refresh} />
            ) : !orders || orders.length === 0 ? (
              <EmptyState
                title="No orders yet"
                hint="Add an order by hand or import a CSV from your sellers to get started."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setModal('add')}>
                      <PlusIcon /> Add order
                    </Button>
                    <Button variant="secondary" onClick={() => setModal('import')}>
                      <UploadIcon /> Import CSV
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-4">Customer</th>
                      <th className="px-4 py-4">Item</th>
                      <th className="px-4 py-4">Seller</th>
                      <th className="px-4 py-4">Address</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4 text-center">Tries</th>
                      <th className="px-5 py-4 text-right">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const isCalling = o.status === 'calling'
                      const isStarting = starting.has(o.id)
                      const rowAnim = isCalling
                        ? 'animate-row-pulse'
                        : added.has(o.id)
                          ? 'animate-slide-in'
                          : changed.has(o.id)
                            ? 'animate-flash'
                            : ''
                      return (
                        <tr
                          key={o.id}
                          onClick={() => setOpenId(o.id)}
                          className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${rowAnim}`}
                        >
                          <td className="px-5 py-4">
                            <div className="text-base font-semibold">{o.customer_name}</div>
                            <div className="whitespace-nowrap text-sm tabular-nums text-slate-500">{formatPhone(o.customer_phone)}</div>
                          </td>
                          <td className="px-4 py-4 text-base">{o.item}</td>
                          <td className="px-4 py-4 text-base text-slate-600">{o.seller}</td>
                          <td className="max-w-[260px] px-4 py-4">
                            <div className="truncate text-base text-slate-600" title={o.cleaned_address || o.address_on_file || ''}>
                              {o.cleaned_address || o.address_on_file || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="px-4 py-4 text-center text-base tabular-nums text-slate-600">{o.attempts ?? 0}</td>
                          <td className="px-5 py-4 text-right">
                            <Button
                              size="sm"
                              variant={isCalling ? 'secondary' : 'primary'}
                              disabled={isCalling || isStarting}
                              onClick={(e) => {
                                e.stopPropagation()
                                callOrder(o)
                              }}
                              className="min-w-[110px]"
                            >
                              {isCalling || isStarting ? <Spinner className="h-4 w-4" /> : <PhoneIcon className="h-4 w-4" />}
                              {isCalling ? 'Calling' : isStarting ? 'Starting' : 'Call'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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

      {modal === 'add' && <AddOrderModal onClose={() => setModal(null)} onCreated={refresh} />}
      {modal === 'import' && <ImportCsvModal onClose={() => setModal(null)} onImported={refresh} />}
      {openId !== null && <OrderDrawer id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </>
  )
}
