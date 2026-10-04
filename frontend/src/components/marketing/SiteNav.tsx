import Link from 'next/link'
import { PhoneIcon, Wordmark } from '../Icons'

const links = [
  { href: '#how', label: 'How it works' },
  { href: '#try', label: 'Hear a call' },
  { href: '#languages', label: 'Languages' },
  { href: '#owners', label: 'For businesses' },
]

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-paper/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-danfo text-ink">
            <PhoneIcon className="h-[18px] w-[18px]" />
          </span>
          <Wordmark className="text-xl text-ink" />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="btn btn-ghost rounded-full px-3.5 py-2 text-[15px] font-medium text-ink-soft hover:text-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost inline-flex rounded-full px-3 py-2 text-[15px] font-semibold text-ink sm:px-4">
            Log in
          </Link>
          <a href="#call-me" className="btn btn-ghost hidden h-10 items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-ink md:inline-flex">
            <PhoneIcon className="h-4 w-4" />
            Get a call
          </a>
          <Link href="/signup" className="btn btn-ink inline-flex h-10 items-center rounded-full px-4 text-[15px] font-semibold">
            Sign up
          </Link>
        </div>
      </nav>
    </header>
  )
}
