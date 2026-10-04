import Link from 'next/link'
import { PLAN_DAYS, PUBLIC_PLANS, PUBLIC_TOP_UPS, naira } from '../../lib/plans'
import { CheckIcon } from '../Icons'
import { Reveal } from './Reveal'

const INCLUDED = [
  'Calls in English, Pidgin, Yorùbá, Hausa and Igbo',
  'Two automatic retries when nobody picks up',
  'Cleaned address and landmark on every order',
  'Full transcript of every call',
]

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">Pay for calls that get answered.</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Pick a plan for {PLAN_DAYS} days. A call only uses one of your calls if the customer picks up, so retries cost you nothing. No contract: renew when you need more.
          </p>
        </Reveal>

        <Reveal group className="mt-12 grid gap-4 md:grid-cols-3">
          {PUBLIC_PLANS.map((p) => (
            <div key={p.id} className="reveal-item flex flex-col rounded-[28px] bg-paper p-6 ring-1 ring-ink/10 sm:p-7">
              <h3 className="font-display text-2xl font-bold text-ink">{p.name}</h3>
              <p className="mt-1 text-[15px] text-ink-soft">{p.for}</p>
              <p className="mt-6 font-display text-4xl font-bold tabular-nums tracking-tight text-ink">
                {naira(p.priceNaira)}
                <span className="ml-1 text-base font-medium tracking-normal text-ink-soft">/ {PLAN_DAYS} days</span>
              </p>
              <p className="mt-2 text-[15px] text-ink">
                <span className="font-semibold">{p.calls} answered calls</span>
                <span className="text-ink-soft"> · about {naira(Math.round(p.priceNaira / p.calls))} each</span>
              </p>
              <Link href={`/signup?plan=${p.id}`} className="btn btn-ink mt-6 inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-semibold">
                Start with {p.name}
              </Link>
            </div>
          ))}
        </Reveal>

        <Reveal className="mt-10 grid gap-8 md:grid-cols-2 md:gap-10">
          <div>
            <h3 className="text-base font-semibold text-ink">Every plan includes</h3>
            <ul className="mt-3 space-y-2.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] text-ink-soft">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-good-soft text-good">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">Need more calls before your plan ends?</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Add{' '}
              {PUBLIC_TOP_UPS.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && ' or '}
                  <span className="font-semibold text-ink">
                    {t.calls} calls for {naira(t.priceNaira)}
                  </span>
                </span>
              ))}{' '}
              from your dashboard at any time.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
