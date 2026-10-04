import Link from 'next/link'
import { SUPPORT_EMAIL } from '../../lib/plans'
import { PhoneIcon, Wordmark } from '../Icons'

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/#how', label: 'How it works' },
      { href: '/#try', label: 'Hear a call' },
      { href: '/#languages', label: 'Languages' },
      { href: '/#pricing', label: 'Pricing' },
      { href: '/#faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/signup', label: 'Create an account' },
      { href: '/login', label: 'Log in' },
      { href: '/join', label: 'Get a call from Tellero AI' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-ink/10 px-4 pb-10 pt-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-danfo text-ink">
                <PhoneIcon className="h-[18px] w-[18px]" />
              </span>
              <Wordmark className="text-xl text-ink" />
            </Link>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-ink-soft">
              AI calls that confirm every delivery before the rider leaves.
            </p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-4 inline-block text-[15px] font-semibold text-ink underline-offset-4 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-semibold text-ink">{col.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[15px] text-ink-soft hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-6 text-sm text-ink-soft">
          <p>© {new Date().getFullYear()} Tellero AI. All rights reserved.</p>
          <p>Built in Lagos</p>
        </div>
      </div>
    </footer>
  )
}
