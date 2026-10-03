import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-2xl font-bold">This page doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary rounded-xl px-5 py-2.5 font-semibold text-white">
        Back to orders
      </Link>
    </div>
  )
}
