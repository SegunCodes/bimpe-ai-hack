'use client'

import { useEffect, useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatPhone } from '../lib/phone'
import type { RiderDelivery } from '../lib/types'
import { BoxIcon, PhoneIcon, PinIcon, Wordmark } from '../components/Icons'
import { Spinner } from '../components/States'

/**
 * What a rider sees from the link the business sends (or reads out on the rider call).
 * Phone-first: one tap to call the customer, one tap to open the address in maps.
 */
export function RiderPage({ orderId, signature }: { orderId: string; signature: string }) {
  const [data, setData] = useState<RiderDelivery | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .riderDelivery(orderId, signature)
      .then(setData)
      .catch((err) => setError(errorMessage(err)))
  }, [orderId, signature])

  return (
    <main className="min-h-dvh bg-paper">
      <header className="bg-ink px-4 pb-6 pt-5 text-white">
        <div className="mx-auto max-w-md">
          {data ? (
            <div className="flex items-center gap-3">
              {data.business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.business.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danfo font-display text-lg font-bold text-ink">
                  {data.business.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm text-white/60">Delivery for {data.business.name}</p>
                <h1 className="truncate font-display text-2xl font-bold">{data.riderName ? `Hi ${data.riderName.split(' ')[0]}` : 'Delivery details'}</h1>
              </div>
            </div>
          ) : (
            <h1 className="font-display text-2xl font-bold">Delivery details</h1>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-3 px-4 py-5">
        {!data && !error && (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-ink" />
          </div>
        )}
        {error && (
          <div className="rounded-3xl bg-white p-5 ring-1 ring-ink/10">
            <p className="font-semibold text-ink">This link isn’t working.</p>
            <p className="mt-1 text-[15px] text-ink-soft">
              It may have expired or been replaced with a new one. Ask the business to send it again.
            </p>
          </div>
        )}
        {data && <Details data={data} />}
      </div>
    </main>
  )
}

function Details({ data }: { data: RiderDelivery }) {
  const o = data.order
  const rescheduled = o.status === 'rescheduled' && o.rescheduleTime
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address}${o.landmark ? `, ${o.landmark}` : ''}, Lagos`)}`
  const confirmed = ['confirmed', 'address_updated', 'rescheduled'].includes(o.status)

  return (
    <>
      <p
        className={`rounded-2xl px-4 py-3 text-[15px] font-medium ${confirmed ? 'bg-good-soft text-good' : 'bg-mist text-ink-soft'}`}
      >
        {confirmed ? 'The customer confirmed these details on a call with Tellero AI.' : 'Not confirmed with the customer yet. Details may change.'}
      </p>

      <section className="rounded-3xl bg-white p-5 ring-1 ring-ink/10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">When</h2>
        <p className="mt-1 text-xl font-bold text-ink">{rescheduled ? o.rescheduleTime : o.deliveryWindow}</p>
        {rescheduled && <p className="mt-0.5 text-sm text-ink-muted">Moved by the customer. It was {o.deliveryWindow}.</p>}
      </section>

      <section className="rounded-3xl bg-white p-5 ring-1 ring-ink/10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Where</h2>
        <p className="mt-1 text-xl font-bold leading-snug text-ink">{o.address}</p>
        {o.landmark && (
          <p className="mt-2 flex items-start gap-1.5 text-base text-ink-soft">
            <PinIcon className="mt-1 h-4 w-4 shrink-0" />
            {o.landmark}
          </p>
        )}
        <a
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-base font-semibold text-ink"
        >
          <PinIcon className="h-4 w-4" /> Open in Maps
        </a>
      </section>

      <section className="rounded-3xl bg-white p-5 ring-1 ring-ink/10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Customer</h2>
        <p className="mt-1 text-xl font-bold text-ink">{o.customerName}</p>
        <p className="text-base text-ink-soft">{formatPhone(o.customerPhone)}</p>
        <a href={`tel:${o.customerPhone}`} className="btn btn-danfo mt-4 flex h-12 items-center justify-center gap-2 rounded-xl text-base font-semibold">
          <PhoneIcon className="h-4 w-4" /> Call {o.customerName.split(' ')[0]}
        </a>
      </section>

      <section className="flex items-center gap-3 rounded-3xl bg-white p-5 ring-1 ring-ink/10">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mist text-ink">
          <BoxIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Item</h2>
          <p className="truncate text-lg font-semibold text-ink">{o.item}</p>
        </div>
      </section>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-ink-muted">
        Sent with <Wordmark className="text-sm text-ink" />
      </p>
    </>
  )
}
