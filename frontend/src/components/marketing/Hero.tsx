import Link from 'next/link'
import { PUBLIC_PLANS, naira } from '../../lib/plans'
import { PhoneIcon } from '../Icons'
import { HeroVideo } from './HeroVideo'

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <p className="hero-fade text-base font-semibold text-ink-soft" style={{ ['--i' as string]: 0 }}>
            AI delivery calls for Lagos sellers
          </p>
          <h1 className="mt-4 font-display text-[2.3rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink sm:text-6xl md:text-7xl">
            <span className="hero-line" style={{ ['--i' as string]: 0 }}>
              Confirmed before
            </span>
            <span className="hero-line" style={{ ['--i' as string]: 1 }}>
              the rider leaves.
            </span>
          </h1>
          <p className="hero-fade mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft sm:text-xl" style={{ ['--i' as string]: 1 }}>
            Tellero AI phones every customer at the time you choose, checks they&apos;re home, turns “by the yellow gate” into an address a rider can find, and
            logs the answer. In English, Pidgin, Yorùbá, Hausa or Igbo.
          </p>
          <div className="hero-fade mt-8 flex flex-wrap items-center justify-center gap-3" style={{ ['--i' as string]: 2 }}>
            <Link href="/signup" className="btn btn-danfo inline-flex h-14 items-center rounded-full px-7 text-lg font-bold">
              Create your account
            </Link>
            <a href="#call-me" className="btn btn-secondary inline-flex h-14 items-center gap-2 rounded-full bg-white px-7 text-lg font-semibold text-ink">
              <PhoneIcon className="h-5 w-5" />
              Get a call from Tellero AI
            </a>
          </div>
          <p className="hero-fade mt-4 text-[15px] text-ink-soft" style={{ ['--i' as string]: 2 }}>
            Plans from {naira(PUBLIC_PLANS[0].priceNaira)} for 30 days · calls nobody answers are free
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-5xl">
          <HeroVideo />
        </div>
      </div>
    </section>
  )
}
