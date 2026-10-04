'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './States'

type Variant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-primary text-white disabled:opacity-50 disabled:shadow-none',
  brand: 'btn-danfo disabled:opacity-50 disabled:shadow-none',
  secondary: 'btn-secondary bg-white text-ink disabled:text-ink-faint',
  ghost: 'btn-ghost text-ink-soft disabled:text-ink-faint',
  danger: 'bg-bad text-white shadow-sm disabled:opacity-50',
}

const SIZES = {
  sm: 'h-10 px-4 text-sm rounded-xl gap-1.5',
  md: 'h-12 px-5 text-base rounded-xl gap-2',
  lg: 'h-14 px-7 text-lg rounded-2xl gap-2.5',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: keyof typeof SIZES
  loading?: boolean
  /** Shown before the label; swapped for a spinner while loading */
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, disabled, icon, className = '', children, ...rest }: Props) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn inline-flex select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  )
}
