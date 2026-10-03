'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { isActiveCall, languageName } from '../lib/format'
import { formatPhone } from '../lib/phone'
import type { Customer } from '../lib/types'
import { usePolling } from '../hooks/usePolling'
import { useChangedIds } from '../hooks/useChangedIds'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { PageHeader } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState, Spinner, StaleBanner } from '../components/States'
import { PhoneIcon, PlusIcon } from '../components/Icons'
import { EASE_OUT } from '../components/Overlay'
import { AddCustomerModal } from './AddCustomerModal'
import { CustomerDrawer } from './CustomerDrawer'

/** Customers plus which of them are on an onboarding call right now. */
async function fetchCustomers() {
  const [customers, calls] = await Promise.all([api.listCustomers(), api.listCalls()])
  const onCall = calls.filter((c) => c.call_type === 'onboarding' && isActiveCall(c.status) && c.customer_id).map((c) => c.customer_id!)
  return { customers, onCall }
}

export function CustomersPage() {
  const toast = useToast()
  const { data, error, loading, refresh } = usePolling(fetchCustomers, 'customers')
  const customers = data?.customers ?? null
  const { added, changed } = useChangedIds(customers)
  const [starting, setStarting] = useState<Set<number>>(new Set())
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const startOnboarding = async (c: Customer) => {
    setStarting((s) => new Set(s).add(c.id))
    try {
      await api.callCustomer(c.id)
      toast.success(`Calling ${c.name} for onboarding…`)
      await refresh()
    } catch (err) {
      toast.error(`Couldn't call ${c.name}: ${errorMessage(err)}`)
    } finally {
      setStarting((s) => {
        const next = new Set(s)
        next.delete(c.id)
        return next
      })
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="People Tellero onboards: it confirms address, landmark, language and the best time to call."
        actions={
          <Button variant="secondary" onClick={() => setAdding(true)} icon={<PlusIcon />}>
            Add customer
          </Button>
        }
      />

      {error && customers && <StaleBanner message={error} />}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
        {loading && !customers ? (
          <LoadingState label="Loading customers…" />
        ) : error && !customers ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : !customers || customers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            hint="Customers appear here when you add one, import orders, or someone signs up on the public /join page."
            action={
              <Button onClick={() => setAdding(true)} icon={<PlusIcon />}>
                Add customer
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">Name</th>
                  <th className="px-4 py-4">Phone</th>
                  <th className="px-4 py-4">Language</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-5 py-4 text-right">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                {customers.map((c) => {
                  const onCall = data!.onCall.includes(c.id)
                  const isStarting = starting.has(c.id)
                  const anim = onCall ? 'animate-row-pulse' : changed.has(c.id) && !added.has(c.id) ? 'animate-flash' : ''
                  return (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, transform: 'translateY(-8px)' }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      onClick={() => setOpenId(c.id)} className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${anim}`}>
                      <td className="px-5 py-4 text-base font-semibold">{c.name || 'Unnamed'}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-base tabular-nums text-slate-600">{formatPhone(c.phone)}</td>
                      <td className="px-4 py-4 text-base text-slate-600">{languageName(c.language)}</td>
                      <td className="px-4 py-4">{onCall ? <StatusBadge status="calling" /> : <StatusBadge status={c.status} />}</td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          variant={onCall ? 'secondary' : 'primary'}
                          disabled={onCall || isStarting}
                          onClick={(e) => {
                            e.stopPropagation()
                            startOnboarding(c)
                          }}
                        >
                          {onCall || isStarting ? <Spinner className="h-4 w-4" /> : <PhoneIcon className="h-4 w-4" />}
                          {onCall ? 'On a call' : isStarting ? 'Starting' : 'Start onboarding call'}
                        </Button>
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

      <AnimatePresence>
        {adding && <AddCustomerModal key="add" onClose={() => setAdding(false)} onCreated={refresh} />}
        {openId !== null && <CustomerDrawer key={`customer-${openId}`} id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
      </AnimatePresence>
    </>
  )
}
