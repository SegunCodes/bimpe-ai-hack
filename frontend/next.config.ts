import type { NextConfig } from 'next'

/**
 * Where the backend lives. Read on the server only (this file never reaches the browser), so
 * the backend's address stays out of the website's code: the browser only ever talks to
 * /api on this site, and Next.js forwards those requests.
 */
function backendOrigin(): string {
  const configured = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '')
  if (configured) return configured.replace(/\/+$/, '')
  return process.env.NODE_ENV === 'production' ? 'https://tellero-ai-2q8u.vercel.app' : 'http://localhost:3001'
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendOrigin()}/api/:path*` }]
  },
}

export default nextConfig
