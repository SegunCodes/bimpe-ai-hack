'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { EASE_OUT } from '../Overlay'
import { Reveal } from './Reveal'

// Sample greetings. Have a native speaker review before launch.
const LANGS = [
  { code: 'en', name: 'English', line: 'Good afternoon! This is Tellero AI, calling about your delivery.' },
  { code: 'pcm', name: 'Pidgin', line: 'Good afternoon o! Na Tellero AI dey call you about your delivery.' },
  { code: 'yo', name: 'Yorùbá', line: 'Ẹ káàsán o! Tellero AI ló ń pè yín nípa ẹrù yín.' },
  { code: 'ha', name: 'Hausa', line: 'Barka da rana! Tellero AI ce ke kiran ku game da kayanku.' },
  { code: 'ig', name: 'Igbo', line: 'Ehihie ọma! Ọ bụ Tellero AI na-akpọ gị maka ngwongwo gị.' },
]

export function Languages() {
  const [code, setCode] = useState('pcm')
  const lang = LANGS.find((l) => l.code === code)!

  return (
    <section id="languages" className="scroll-mt-20 bg-danfo px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">Speaks the way your customers speak.</h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink/80">
            Tellero AI greets people in their language and switches when they do. Onboarding calls ask for a preference once, so every delivery call after that
            starts right.
          </p>
          <div className="mt-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Pick a language">
            {LANGS.map((l) => (
              <button
                key={l.code}
                role="radio"
                aria-checked={code === l.code}
                onClick={() => setCode(l.code)}
                className={`btn h-12 rounded-full px-5 text-base font-semibold ${code === l.code ? 'btn-ink' : 'bg-white/60 text-ink hover:bg-white'}`}
              >
                {l.name}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <div className="relative rounded-[28px] bg-ink p-6 text-white shadow-[0_30px_70px_-30px_rgb(11_18_32/0.7)] sm:p-8">
            <p className="text-sm font-semibold text-white/60">Tellero AI, opening line</p>
            {/* Both lines share one grid cell so the card never jumps in height */}
            <div className="mt-4 grid min-h-[7.5rem]">
              <AnimatePresence initial={false}>
                <motion.p
                  key={lang.code}
                  initial={{ opacity: 0, filter: 'blur(4px)', transform: 'translateY(8px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)', transition: { duration: 0.3, ease: EASE_OUT } }}
                  exit={{ opacity: 0, filter: 'blur(2px)', transform: 'translateY(-6px)', transition: { duration: 0.15, ease: EASE_OUT } }}
                  className="col-start-1 row-start-1 font-display text-2xl font-semibold leading-snug sm:text-3xl"
                  lang={lang.code === 'pcm' ? 'pcm' : lang.code}
                >
                  “{lang.line}”
                </motion.p>
              </AnimatePresence>
            </div>
            <p className="mt-6 text-sm text-white/60">{lang.name}</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
