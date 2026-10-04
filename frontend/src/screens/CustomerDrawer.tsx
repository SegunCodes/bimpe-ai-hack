'use client'

import { useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatDateTime, isActiveCall, languageName, newestFirst } from '../lib/format'
import { formatPhone } from '../lib/phone'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { CallHistory, InfoItem } from '../components/CallCard'
import { Drawer } from '../components/Overlay'
import { StatusBadge } from '../components/StatusBadge'
import { ErrorState, LoadingState, StaleBanner } from '../components/States'
import { PhoneIcon } from '../components/Icons'

export function CustomerDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const { data: customer, error, loading, refresh } = usePolling(() => api.getCustomer(id), `customer-${id}`)
  const [starting, setStarting] = useState(false)

  const calls = newestFirst(customer?.calls ?? [])
  const onCall = calls.some((c) => c.call_type === 'onboarding' && isActiveCall(c.status))

  const call = async () => {
    if (!customer) return
    setStarting(true)
    try {
      await api.callCustomer(customer.id)
      toast.success(`Calling ${customer.name} for onboarding…`)
      refresh()
      onChanged()
    } catch (err) {
      toast.error(`Couldn't start the call: ${errorMessage(err)}`)
    } finally {
      setStarting(false)
    }
  }

  const consent = customer?.consent_to_calls == null ? null : customer.consent_to_calls ? '✅ Yes, happy to be called' : '❌ No'

  return (
    <Drawer onClose={onClose}>
      {loading && !customer && <LoadingState label="Loading customer…" />}
      {error && !customer && <ErrorState message={error} onRetry={refresh} />}
      {customer && (
        <div className="flex flex-col gap-5 p-4 pt-5 sm:gap-6 sm:p-8">
          {error && <StaleBanner message={error} />}
          <header className="pr-12">
            <p className="text-sm font-semibold text-ink-muted">Customer #{customer.id}</p>
            <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl tracking-[-0.02em] text-ink">{customer.name || 'Unnamed'}</h2>
            <p className="mt-1 text-base sm:text-lg tabular-nums text-ink-soft">{formatPhone(customer.phone)}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge status={onCall ? 'calling' : customer.status} size="lg" />
              <Button onClick={call} loading={starting} disabled={onCall} icon={<PhoneIcon />}>
                {onCall ? 'On a call…' : 'Start onboarding call'}
              </Button>
            </div>
          </header>

          <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/10 sm:p-6">
            <h3 className="mb-4 text-lg font-bold text-ink">Profile collected by Tellero AI</h3>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <InfoItem label="Address" value={customer.address} wide />
              <InfoItem label="Landmark" value={customer.landmark} />
              <InfoItem label="Language" value={customer.language ? languageName(customer.language) : null} />
              <InfoItem label="Best time to call" value={customer.best_time_to_call} />
              <InfoItem label="Consent to calls" value={consent} />
              <InfoItem label="Joined" value={formatDateTime(customer.created_at)} />
              <InfoItem label="Last updated" value={formatDateTime(customer.updated_at)} />
            </dl>
          </section>

          <CallHistory calls={calls} />
        </div>
      )}
    </Drawer>
  )
}
