'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { api } from '../lib/api'
import { formatDuration, isActiveCall, newestFirst, timeAgo } from '../lib/format'
import { formatPhone } from '../lib/phone'
import type { Call } from '../lib/types'
import { usePolling } from '../hooks/usePolling'
import { useChangedIds } from '../hooks/useChangedIds'
import { BoxIcon, UserPlusIcon } from './Icons'
import { CallCard } from './CallCard'
import { EASE_IN_OUT, EASE_OUT, Modal } from './Overlay'
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
  const { changed } = useChangedIds(data?.calls ?? null)
  const [openId, setOpenId] = useState<number | null>(null)

  if (loading && !data) return <LoadingState label="Loading calls…" />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />
  if (!data) return null

  const calls = limit ? data.calls.slice(0, limit) : data.calls

  return (
    <div>
      {error && <StaleBanner message={error} />}
      {calls.length === 0 ? (
        <EmptyState title="No calls yet" hint="Calls show up here the moment Tellero dials. Scheduled orders call on their own." />
      ) : (
        <motion.ul layoutRoot className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
          {/* initial={false}: no entrance on page load, only for calls that arrive while watching */}
          <AnimatePresence initial={false}>
          {calls.map((call) => {
            const who = call.customer_id ? data.names[call.customer_id] : undefined
            const item = call.order_id ? data.items[call.order_id] : undefined
            const active = isActiveCall(call.status)
            return (
              <motion.li
                key={call.id}
                layout="position"
                initial={{ opacity: 0, transform: 'translateY(-16px) scale(0.97)' }}
                animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
                exit={{ opacity: 0, transform: 'scale(0.97)' }}
                transition={{ duration: 0.35, ease: EASE_OUT, layout: { duration: 0.3, ease: EASE_IN_OUT } }}
              >
                <button
                  onClick={() => setOpenId(call.id)}
                  className={`btn card-hover flex w-full items-center gap-3 rounded-3xl bg-white text-left shadow-sm ring-1 ${changed.has(call.id) ? 'animate-flash' : ''} ${
                    active ? 'ring-2 ring-danfo' : 'ring-ink/10'
                  } ${compact ? 'p-3.5' : 'p-3.5 sm:gap-4 sm:p-5'}`}
                >
                  <div
                    className={`flex shrink-0 items-center justify-center rounded-2xl ${
                      call.call_type === 'onboarding' ? 'bg-mist text-ink' : 'bg-danfo-soft text-ink'
                    } ${compact ? 'h-10 w-10' : 'h-11 w-11 sm:h-14 sm:w-14'}`}
                  >
                    {call.call_type === 'onboarding' ? (
                      <UserPlusIcon className={compact ? 'h-5 w-5' : 'h-5 w-5 sm:h-7 sm:w-7'} />
                    ) : (
                      <BoxIcon className={compact ? 'h-5 w-5' : 'h-5 w-5 sm:h-7 sm:w-7'} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-bold ${compact ? 'text-base' : 'text-base sm:text-xl'}`}>{who?.name ?? 'Unknown customer'}</div>
                    <div className={`truncate text-ink-muted ${compact ? 'text-xs' : 'text-sm sm:text-base'}`}>
                      {call.call_type === 'onboarding' ? 'Onboarding' : `Delivery${item ? ` · ${item}` : ''}`}
                      {!compact && who && ` · ${formatPhone(who.phone)}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {/* Compact view and phones: one badge (the outcome once known) so names have room */}
                      {(!compact || !call.outcome) && (
                        <span className={call.outcome ? 'hidden sm:inline-flex' : 'inline-flex'}>
                          <StatusBadge status={call.status} size={compact ? 'sm' : 'md'} />
                        </span>
                      )}
                      {call.outcome && <StatusBadge status={call.outcome} size={compact ? 'sm' : 'md'} />}
                    </div>
                    <span className="text-xs text-ink-faint">
                      {timeAgo(call.created_at)}
                      {call.duration_seconds != null && ` · ${formatDuration(call.duration_seconds)}`}
                    </span>
                  </div>
                </button>
              </motion.li>
            )
          })}
          </AnimatePresence>
        </motion.ul>
      )}
      <AnimatePresence>{openId !== null && <CallModal key={openId} id={openId} onClose={() => setOpenId(null)} />}</AnimatePresence>
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
