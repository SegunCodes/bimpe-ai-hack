import { useState } from 'react'
import { api } from '../lib/api'
import { formatDuration, isActiveCall, newestFirst, timeAgo } from '../lib/format'
import { formatPhone } from '../lib/phone'
import type { Call } from '../lib/types'
import { usePolling } from '../hooks/usePolling'
import { useChangedIds } from '../hooks/useChangedIds'
import { BoxIcon, UserPlusIcon } from './Icons'
import { CallCard } from './CallCard'
import { Modal } from './Overlay'
import { StatusBadge } from './StatusBadge'
import { EmptyState, ErrorState, LoadingState, StaleBanner } from './States'

export interface FeedData {
  calls: Call[]
  names: Record<number, { name: string; phone: string }>
  items: Record<number, string>
}

/** Calls plus the names/items needed to say who each call is for. */
export async function fetchFeed(): Promise<FeedData> {
  const [calls, customers, orders] = await Promise.all([api.listCalls(), api.listCustomers(), api.listOrders()])
  const names: FeedData['names'] = {}
  customers.forEach((c) => (names[c.id] = { name: c.name, phone: c.phone }))
  const items: FeedData['items'] = {}
  orders.forEach((o) => (items[o.id] = o.item))
  return { calls: newestFirst(calls), names, items }
}

export function useFeed() {
  return usePolling(fetchFeed, 'feed')
}

export function LiveFeed({ compact, limit }: { compact?: boolean; limit?: number }) {
  const { data, error, loading, refresh } = useFeed()
  const { added, changed } = useChangedIds(data?.calls ?? null)
  const [openId, setOpenId] = useState<number | null>(null)

  if (loading && !data) return <LoadingState label="Loading calls…" />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />
  if (!data) return null

  const calls = limit ? data.calls.slice(0, limit) : data.calls

  return (
    <div>
      {error && <StaleBanner message={error} />}
      {calls.length === 0 ? (
        <EmptyState title="No calls yet" hint="Press “Call” on an order or customer and it will show up here instantly." />
      ) : (
        <ul className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
          {calls.map((call) => {
            const who = call.customer_id ? data.names[call.customer_id] : undefined
            const item = call.order_id ? data.items[call.order_id] : undefined
            const active = isActiveCall(call.status)
            const anim = added.has(call.id) ? 'animate-slide-in' : changed.has(call.id) ? 'animate-flash' : ''
            return (
              <li key={call.id} className={anim}>
                <button
                  onClick={() => setOpenId(call.id)}
                  className={`flex w-full items-center gap-4 rounded-3xl bg-white text-left shadow-sm ring-1 transition hover:shadow-md ${
                    active ? 'ring-2 ring-blue-300' : 'ring-slate-200'
                  } ${compact ? 'p-3.5' : 'p-5'}`}
                >
                  <div
                    className={`flex shrink-0 items-center justify-center rounded-2xl ${
                      call.call_type === 'onboarding' ? 'bg-purple-100 text-purple-700' : 'bg-accent-100 text-accent-700'
                    } ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}
                  >
                    {call.call_type === 'onboarding' ? (
                      <UserPlusIcon className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
                    ) : (
                      <BoxIcon className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-bold ${compact ? 'text-base' : 'text-xl'}`}>{who?.name ?? 'Unknown customer'}</div>
                    <div className={`truncate text-slate-500 ${compact ? 'text-xs' : 'text-base'}`}>
                      {call.call_type === 'onboarding' ? 'Onboarding' : `Delivery${item ? ` · ${item}` : ''}`}
                      {!compact && who && ` · ${formatPhone(who.phone)}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {/* Compact view: one badge (the outcome once known) so names have room */}
                      {(!compact || !call.outcome) && <StatusBadge status={call.status} size={compact ? 'sm' : 'lg'} />}
                      {call.outcome && <StatusBadge status={call.outcome} size={compact ? 'sm' : 'lg'} />}
                    </div>
                    <span className="text-xs text-slate-400">
                      {timeAgo(call.created_at)}
                      {call.duration_seconds != null && ` · ${formatDuration(call.duration_seconds)}`}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {openId !== null && <CallModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function CallModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, error, loading, refresh } = usePolling(() => api.getCall(id), `call-${id}`)
  return (
    <Modal title={`Call #${id}`} onClose={onClose} wide>
      {loading && !data && <LoadingState />}
      {error && !data && <ErrorState message={error} onRetry={refresh} />}
      {data && <CallCard call={data} />}
    </Modal>
  )
}
