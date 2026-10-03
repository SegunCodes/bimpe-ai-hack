import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-white">
      <p className="font-display text-4xl font-bold tracking-[-0.02em]">This page doesn&apos;t exist.</p>
      <Link href="/dashboard" className="btn btn-danfo rounded-full px-6 py-3 font-semibold">
        Go to the dashboard
      </Link>
    </div>
  )
}
