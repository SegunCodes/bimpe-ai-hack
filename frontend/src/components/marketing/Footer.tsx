import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-ink/10 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-ink-soft">
        <p>
          <span className="font-display font-bold text-ink">Tellero</span> · AI delivery calls, handled. Built in Lagos.
        </p>
        <div className="flex gap-5">
          <Link href="/dashboard" className="hover:text-ink">
            Dashboard
          </Link>
          <Link href="/join" className="hover:text-ink">
            Signup page
          </Link>
        </div>
      </div>
    </footer>
  )
}
