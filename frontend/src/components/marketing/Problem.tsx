import { Reveal } from './Reveal'

export function Problem() {
  return (
    <section className="px-4 py-24 sm:px-6">
      <Reveal className="mx-auto max-w-4xl" group>
        <p className="reveal-item text-base font-semibold text-ink-soft">Every failed delivery has the same story</p>
        <p className="reveal-item mt-4 font-display text-3xl font-semibold leading-[1.25] tracking-[-0.02em] text-ink sm:text-[2.6rem]">
          The rider reaches Lekki. The customer is <span className="marker" style={{ ['--i' as string]: 0 }}>at work in Ikeja</span>. The address says{' '}
          <span className="marker" style={{ ['--i' as string]: 1 }}>“by the yellow gate”</span>. Nobody called first, so the parcel{' '}
          <span className="marker" style={{ ['--i' as string]: 2 }}>rides back to the hub</span>.
        </p>
        <p className="reveal-item mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft">
          One short call before dispatch fixes all three. But nobody has time to phone a hundred customers a day. Tellero AI does.
        </p>
      </Reveal>
    </section>
  )
}
