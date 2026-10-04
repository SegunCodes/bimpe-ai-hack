import { HeroVideo } from './HeroVideo'

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <p className="hero-fade inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-ink-soft shadow-sm ring-1 ring-ink/10" style={{ ['--i' as string]: 0 }}>
            <span className="h-2 w-2 rounded-full bg-danfo ring-2 ring-danfo/30" />
            An AI phone agent for Lagos deliveries
          </p>
          <h1 className="mt-6 font-display text-[2.3rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink sm:text-6xl md:text-7xl">
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
            <a href="#call-me" className="btn btn-danfo inline-flex h-14 items-center rounded-full px-7 text-lg font-bold">
              Get a call from Tellero AI
            </a>
            <a href="#try" className="btn btn-secondary inline-flex h-14 items-center rounded-full bg-white px-7 text-lg font-semibold text-ink">
              Hear a sample call
            </a>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-5xl">
          <HeroVideo />
        </div>
      </div>
    </section>
  )
}
