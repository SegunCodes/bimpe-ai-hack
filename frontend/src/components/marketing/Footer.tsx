import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-ink/10 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-ink-soft">
        <p>
          <span className="font-display font-bold text-ink">Tellero</span> · AI delivery calls, handled. Built in Lagos.
        </p>
        <div className="flex gap-5">
          <Link href="/signup" className="hover:text-ink">
            Sign up
          </Link>
          <Link href="/login" className="hover:text-ink">
            Log in
          </Link>
          <Link href="/join" className="hover:text-ink">
            Try a call
          </Link>
        </div>
      </div>
    </footer>
  )
}
