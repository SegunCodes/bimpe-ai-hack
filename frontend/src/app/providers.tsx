'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/Toast'

export function Providers({ children }: { children: ReactNode }) {
  // reducedMotion="user": Motion drops transform/layout movement for people who ask for less motion,
  // but keeps opacity fades so state changes are still legible.
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  )
}
