import { Reveal } from './Reveal'
import { SchedulePlayground } from './SchedulePlayground'

const steps = [
  {
    title: 'Add the order',
    body: 'Type it in or import a CSV from your store: who, what, where, and the delivery slot.',
  },
  {
    title: 'Pick when Tellero AI calls',
    body: 'Two hours before, the morning of, or the evening before. One choice, then you’re done.',
  },
  {
    title: 'Read the answer',
    body: 'Confirmed, rescheduled, or a cleaner address with a landmark, plus the full transcript of the call.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">You add the order. Tellero AI makes the call.</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">The whole job for the business owner is one form. Everything after it happens on its own.</p>
        </Reveal>

        <Reveal group className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
          {steps.map((s, i) => (
            <div key={s.title} className="reveal-item">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-base font-bold text-white">{i + 1}</span>
                <h3 className="font-display text-xl font-bold text-ink">{s.title}</h3>
              </div>
              {/* Body lines up under the title, not under the number */}
              <p className="mt-2 pl-12 text-base leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          ))}
        </Reveal>

        <Reveal className="mt-16">
          <p className="mb-4 text-base font-semibold text-ink">Try it: pick a slot and a rule.</p>
          <SchedulePlayground />
        </Reveal>
      </div>
    </section>
  )
}
