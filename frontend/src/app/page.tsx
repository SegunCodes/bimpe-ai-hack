import { CallMe } from '@/components/marketing/CallMe'
import { CallSimulator } from '@/components/marketing/CallSimulator'
import { Footer } from '@/components/marketing/Footer'
import { Hero } from '@/components/marketing/Hero'
import { HowItWorks } from '@/components/marketing/HowItWorks'
import { Languages } from '@/components/marketing/Languages'
import { Owners } from '@/components/marketing/Owners'
import { Pricing } from '@/components/marketing/Pricing'
import { Faq } from '@/components/marketing/Faq'
import { Problem } from '@/components/marketing/Problem'
import { Reveal } from '@/components/marketing/Reveal'
import { SiteNav } from '@/components/marketing/SiteNav'

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteNav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <section id="try" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">Listen in on a call.</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">Pick a situation. Watch the order update as the customer answers.</p>
            </Reveal>
            <CallSimulator />
          </div>
        </section>
        <Languages />
        <Owners />
        <Pricing />
        <Faq />
        <CallMe />
      </main>
      <Footer />
    </div>
  )
}
