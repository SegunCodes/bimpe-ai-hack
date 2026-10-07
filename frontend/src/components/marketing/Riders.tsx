import { BikeIcon, CheckIcon, PhoneIcon, PinIcon } from '../Icons'
import { Reveal } from './Reveal'

const points = [
  'Tellero AI calls the rider as soon as the customer confirms',
  'The confirmed address, landmark, delivery time and customer’s number, read out one at a time',
  'A private link with the same details to send on WhatsApp: no app to install',
  'Prefer only the link? Switch rider calls off in Settings',
]

/** Homepage: what happens after the customer says yes. The phone mirrors the real rider page. */
export function Riders() {
  return (
    <section id="riders" className="scroll-mt-20 bg-ink px-4 py-16 text-white sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Reveal>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-danfo text-ink">
            <BikeIcon className="h-6 w-6" />
          </span>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">Your rider knows before they leave.</h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/70">
            Pick a rider when you add the order. Once the customer confirms, Tellero AI calls the rider with exactly what the customer said, so nobody
            rides around looking for a gate.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-base text-white/90">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danfo text-ink">
                  <CheckIcon className="h-3 w-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="mx-auto w-full max-w-[22rem]">
          <div
            className="overflow-hidden rounded-[36px] bg-paper p-2.5 text-ink shadow-[0_40px_80px_-40px_rgb(0_0_0/0.8)] ring-1 ring-white/10"
            aria-label="Example of the page a rider receives"
          >
            <div className="rounded-[28px] bg-ink px-4 pb-5 pt-4 text-white">
              <p className="text-xs text-white/60">Delivery for Mama Put Kitchen</p>
              <p className="font-display text-xl font-bold">Hi Tunde</p>
            </div>
            <div className="flex flex-col gap-2 p-1.5 pt-3">
              <p className="rounded-2xl bg-good-soft px-3.5 py-2.5 text-sm font-medium text-good">The customer confirmed these details on a call.</p>
              <div className="rounded-2xl bg-white p-3.5 ring-1 ring-ink/10">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">When</p>
                <p className="font-bold">Wed 8 Oct, 10am – 1pm</p>
              </div>
              <div className="rounded-2xl bg-white p-3.5 ring-1 ring-ink/10">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Where</p>
                <p className="font-bold leading-snug">Plot 4, Bode Thomas Street, Surulere</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                  <PinIcon className="h-3.5 w-3.5 shrink-0" /> Opposite the Mobil filling station
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-ink/10">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Customer</p>
                  <p className="truncate font-bold">Chidinma Eze</p>
                </div>
                <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-danfo px-3 text-sm font-semibold">
                  <PhoneIcon className="h-3.5 w-3.5" /> Call
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
