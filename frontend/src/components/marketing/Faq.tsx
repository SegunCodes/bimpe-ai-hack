import Link from 'next/link'
import type { ReactNode } from 'react'
import { SUPPORT_EMAIL } from '../../lib/plans'
import { Reveal } from './Reveal'

const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: 'Is it a real person on the phone?',
    a: 'No. Tellero AI is an AI voice agent. Every call opens with your business’s name and the reason for the call, for example “Hi Chidinma, I’m Tellero AI, calling from Mama Put Kitchen to confirm the delivery of your jollof rice tray.” It speaks naturally and keeps calls short: usually under two minutes.',
  },
  {
    q: 'What happens if the customer doesn’t pick up?',
    a: 'Tellero AI tries again twice, 30 minutes apart. Calls nobody answers don’t use any of your plan’s calls. If all three attempts go unanswered, the order is marked “Needs you” on your dashboard so you can follow up.',
  },
  {
    q: 'Which languages can it speak?',
    a: 'English, Nigerian Pidgin, Yorùbá, Hausa and Igbo. It starts in the customer’s preferred language and switches if they reply in another one.',
  },
  {
    q: 'How do I give it my orders?',
    a: 'Add an order in the dashboard with the customer, item, address and delivery slot, or import a CSV from your store. Then pick when Tellero AI should call, for example two hours before the delivery window. That’s it.',
  },
  {
    q: 'What do I get back after a call?',
    a: 'Each order shows whether the customer confirmed, gave a new time or corrected the address, plus a landmark a rider can see, and the full transcript of the call.',
  },
  {
    q: 'Can Tellero AI tell my rider the details?',
    a: 'Yes. Add your riders in Settings and pick one on an order. As soon as the customer confirms, Tellero AI calls the rider with the confirmed address, landmark, delivery time and the customer’s number. A rider call uses one of your plan’s calls, only if the rider picks up. You can switch rider calls off and just send the link instead.',
  },
  {
    q: 'Does my rider need to download an app?',
    a: 'No. Every order with a rider has a private link with the delivery details, a button to open the address in maps and a button to call the customer. Send it on WhatsApp from the order in one tap. The link stops working a few days after the delivery, or as soon as you change the order’s rider.',
  },
  {
    q: 'What happens when I run out of calls?',
    a: 'A call already in progress always finishes. New calls wait instead of failing, and your dashboard asks you to top up. Once you do, the waiting calls go out on their own. If an order’s delivery time passes while it waits, it’s marked as missed.',
  },
  {
    q: 'Is my customers’ information safe?',
    a: (
      <>
        Only your account can see your customers, orders and calls. Tellero AI never asks customers for card details, bank details, PINs or passwords. Read our{' '}
        <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">
          privacy policy
        </Link>{' '}
        for the details.
      </>
    ),
  },
  {
    q: 'Can I cancel?',
    a: 'There’s nothing to cancel. Plans last 30 days and don’t renew automatically. If you don’t pay again, calls simply stop at the end of the 30 days.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">Questions owners ask.</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Something else? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-ink underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </Reveal>
        <Reveal group>
          <div className="divide-y divide-ink/10 border-y border-ink/10">
            {QUESTIONS.map(({ q, a }) => (
              <details key={q} className="faq reveal-item group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-lg font-semibold text-ink">
                  {q}
                  <span aria-hidden className="faq-icon relative h-4 w-4 shrink-0 text-ink-soft">
                    <span className="absolute left-0 top-1/2 h-[2px] w-4 -translate-y-1/2 rounded bg-current" />
                    <span className="faq-icon-v absolute left-1/2 top-0 h-4 w-[2px] -translate-x-1/2 rounded bg-current" />
                  </span>
                </summary>
                <div className="pb-5 pr-10 text-base leading-relaxed text-ink-soft">{a}</div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
