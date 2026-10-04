import type { ReactNode } from 'react'
import { Footer } from './Footer'
import { SiteNav } from './SiteNav'

/** Plain reading layout for the Privacy and Terms pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteNav />
      <main className="px-4 py-14 sm:px-6 sm:py-20">
        <article className="legal mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">{title}</h1>
          <p className="mt-3 text-[15px] text-ink-soft">Last updated {updated}</p>
          <div className="mt-10">{children}</div>
        </article>
      </main>
      <Footer />
    </div>
  )
}
