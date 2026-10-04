import Link from 'next/link'
import { StatusBadge } from '../StatusBadge'
import { Reveal } from './Reveal'

const rows = [
  { name: 'Adaeze O.', item: 'Bluetooth speaker', status: 'confirmed', call: 'Home from 4pm' },
  { name: 'Tunde B.', item: 'Ankara fabric', status: 'address_updated', call: 'Landmark: opp. Mobil' },
  { name: 'Chiamaka E.', item: 'Rice cooker', status: 'rescheduled', call: 'Tomorrow, 9am – 12pm' },
  { name: 'Femi A.', item: 'Phone case', status: 'calling', call: 'On the phone now' },
  { name: 'Bisi K.', item: 'Hair dryer', status: 'scheduled', call: 'Today, 5:30 pm' },
]

const points = [
  'Retries twice, 30 minutes apart, then flags it for you',
  'Asks for a landmark a rider can actually see',
  'Every call recorded and transcribed',
  'Import a CSV from your store in one go',
]

export function Owners() {
  return (
    <section id="owners" className="scroll-mt-20 px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">One screen. You only read it.</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            The Tellero dashboard shows every order, when Tellero will call, and what the customer said. Riders leave with addresses they can find.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-base text-ink">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span>
                {p}
              </li>
            ))}
          </ul>
          <Link href="/signup" className="btn btn-ink mt-8 inline-flex h-12 items-center rounded-full px-6 text-base font-semibold">
            Create your business account
          </Link>
        </Reveal>

        <Reveal group>
          <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_30px_70px_-40px_rgb(11_18_32/0.5)] ring-1 ring-ink/10" aria-label="Example of the orders dashboard">
            <div className="flex items-center gap-2 border-b border-ink/5 px-5 py-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-ink/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink/10" />
              <span className="ml-3 text-sm font-semibold text-ink-soft">Orders · today</span>
            </div>
            <ul>
              {rows.map((r) => (
                <li
                  key={r.name}
                  className={`reveal-item flex items-center gap-4 border-b border-ink/5 px-5 py-4 last:border-0 ${r.status === 'calling' ? 'animate-row-pulse' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{r.name}</p>
                    <p className="truncate text-sm text-ink-soft">{r.item}</p>
                  </div>
                  <p className="hidden w-44 truncate text-sm text-ink-soft sm:block">{r.call}</p>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
