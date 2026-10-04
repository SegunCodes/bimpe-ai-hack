'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { usePolling } from '../hooks/usePolling'
import { useBusiness } from '../hooks/useBusiness'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { PageHeader } from '../components/Layout'
import { ErrorState, LoadingState } from '../components/States'
import type { Plan, TopUp } from '../lib/types'

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`

/** After Paystack sends the business back (?reference=…), confirm the payment once. */
function PaymentReturn({ onDone }: { onDone: () => void }) {
  const params = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const reference = params.get('reference')
  const handled = useRef<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!reference || handled.current === reference) return
    handled.current = reference
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecking(true)
    api
      .verifyPayment(reference)
      .then((r) => {
        if (r.status === 'paid') toast.success(`Payment received. ${r.business?.plan.planName ?? 'Your'} plan is on, and Tellero AI can start calling.`)
        else if (r.status === 'pending') toast.info('Paystack is still confirming your payment. This page will update when it does.')
        else toast.error("The payment didn't go through. You haven't been charged for a plan.")
      })
      .catch((err) => toast.error(`Couldn't confirm the payment: ${errorMessage(err)}`))
      .finally(() => {
        setChecking(false)
        onDone()
        router.replace('/dashboard/billing')
      })
  }, [reference, router, toast, onDone])

  if (!checking) return null
  return <div className="mb-5 rounded-2xl bg-danfo-soft px-4 py-3 text-[15px] text-ink ring-1 ring-danfo/60">Confirming your payment with Paystack…</div>
}

function Welcome({ plans }: { plans: Plan[] }) {
  const params = useSearchParams()
  if (!params.get('welcome')) return null
  const picked = plans.find((p) => p.id === params.get('plan'))
  return (
    <div className="mb-5 rounded-3xl bg-ink px-5 py-4 text-white">
      <p className="font-display text-xl font-bold">Your account is ready.</p>
      <p className="mt-1 text-white/70">
        {picked ? `You picked ${picked.name}. Pay below and Tellero AI can start calling your customers.` : 'Choose a plan so Tellero AI can start calling your customers.'} You can add orders and customers before you pay.
      </p>
    </div>
  )
}

function PlanCard({ plan, current, onChoose, busy, disabled }: { plan: Plan; current: boolean; onChoose: () => void; busy: boolean; disabled: boolean }) {
  const perCall = Math.round(plan.priceNaira / plan.calls)
  return (
    <div className={`flex flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 sm:p-6 ${current ? 'ring-2 ring-ink' : 'ring-ink/10'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-ink">{plan.name}</h2>
        {current && <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">Your plan</span>}
      </div>
      <p className="mt-3 font-display text-4xl font-bold tabular-nums text-ink">
        {naira(plan.priceNaira)}
        <span className="text-base font-medium text-ink-muted"> / {plan.days} days</span>
      </p>
      <ul className="mt-4 flex-1 space-y-1.5 text-[15px] text-ink-soft">
        <li>
          <span className="font-semibold text-ink">{plan.calls.toLocaleString('en-NG')} calls</span> included
        </li>
        <li>About {naira(perCall)} per answered call</li>
        <li>Calls nobody picks up are free</li>
        <li>English, Pidgin, Yorùbá, Hausa and Igbo</li>
        <li>Automatic retries when nobody picks up</li>
      </ul>
      <Button variant={current ? 'secondary' : 'brand'} className="mt-5 w-full" loading={busy} disabled={disabled} onClick={onChoose}>
        {current ? `Renew: +${plan.calls} calls, 30 more days` : `Choose ${plan.name}`}
      </Button>
    </div>
  )
}

function TopUps({ topUps, onChoose, paying, disabled }: { topUps: TopUp[]; onChoose: (id: string) => void; paying: string | null; disabled: boolean }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl font-bold text-ink">Need more calls this month?</h2>
      <p className="mt-0.5 text-[15px] text-ink-muted">Top-ups add calls to your current plan straight away. They never expire while you have a plan.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {topUps.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-4 rounded-3xl bg-white p-4 ring-1 ring-ink/10 sm:p-5">
            <div>
              <p className="text-base font-semibold text-ink">{t.name}</p>
              <p className="text-[15px] text-ink-muted">{naira(t.priceNaira)}</p>
            </div>
            <Button variant="secondary" size="sm" loading={paying === t.id} disabled={disabled || (paying !== null && paying !== t.id)} onClick={() => onChoose(t.id)}>
              Buy
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}

export function BillingPage() {
  const toast = useToast()
  const { refresh: refreshBusiness } = useBusiness()
  const { data, error, loading, refresh } = usePolling(api.billing, 'billing', 15_000)
  const [paying, setPaying] = useState<string | null>(null)

  const choose = async (plan: string) => {
    setPaying(plan)
    try {
      const { url } = await api.checkout(plan)
      window.location.assign(url) // Paystack's secure payment page
    } catch (err) {
      toast.error(errorMessage(err))
      setPaying(null)
    }
  }

  const afterPayment = () => {
    refresh()
    refreshBusiness()
  }

  if (loading && !data) return <LoadingState label="Loading your plan…" />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />
  if (!data) return null
  const status = data.business.plan

  return (
    <>
      <PageHeader title="Plan & billing" subtitle="Tellero AI calls your customers while your plan is active. Each plan lasts 30 days." />
      <Suspense>
        <Welcome plans={data.plans} />
        <PaymentReturn onDone={afterPayment} />
      </Suspense>

      <section className={`mb-6 rounded-3xl p-5 sm:p-6 ${status.active ? 'bg-white ring-1 ring-ink/10' : 'bg-danfo-soft ring-1 ring-danfo/60'}`}>
        {status.active ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ink-muted">Current plan</p>
              <p className="font-display text-3xl font-bold text-ink">{status.planName}</p>
              <p className="mt-1 text-[15px] text-ink-soft">Active until {formatDateTime(status.expiresAt)}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-ink-muted">Calls left</p>
              <p className={`font-display text-4xl font-bold tabular-nums ${status.outOfCredits ? 'text-bad' : 'text-ink'}`}>{status.callsLeft}</p>
              <p className="text-[15px] text-ink-soft">{status.callsUsed} answered calls this plan period</p>
            </div>
            {status.outOfCredits && (
              <p className="w-full rounded-2xl bg-bad-soft px-4 py-3 text-[15px] text-bad">
                You’re out of calls. Scheduled calls are waiting, not cancelled: buy a top-up below and they go out right away. Any order whose delivery time passes while waiting is marked as missed.
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="font-display text-xl font-bold text-ink">You don’t have a plan yet</p>
            <p className="mt-1 text-[15px] text-ink-soft">Pick one below. Calls start as soon as the payment goes through.</p>
          </div>
        )}
      </section>

      {!data.paymentsEnabled && (
        <p className="mb-5 rounded-2xl bg-white px-4 py-3 text-[15px] text-ink-soft ring-1 ring-ink/10">
          Online payment isn’t switched on yet. Contact the Tellero AI team and they’ll turn your plan on for you.
        </p>
      )}

      {status.active && <TopUps topUps={data.topUps} onChoose={choose} paying={paying} disabled={!data.paymentsEnabled} />}

      <h2 className="mb-3 font-display text-xl font-bold text-ink">{status.active ? 'Change or renew your plan' : 'Choose a plan'}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {data.plans.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            current={status.active && status.plan === p.id}
            busy={paying === p.id}
            disabled={!data.paymentsEnabled || (paying !== null && paying !== p.id)}
            onChoose={() => choose(p.id)}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-muted">
        Payments are handled securely by Paystack. A plan runs for 30 days and adds its calls to your balance; unused calls carry over when you renew. A call only uses a credit if the customer picks up.
      </p>
    </>
  )
}
