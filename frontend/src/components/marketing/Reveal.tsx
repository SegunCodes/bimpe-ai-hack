'use client'

import { useEffect, useLayoutEffect, useRef, type ElementType, type ReactNode } from 'react'

/**
 * Sets data-visible once when the element scrolls into view (fires once, never re-animates).
 * With `group`, children marked .reveal-item get a stagger index from the DOM.
 */
export function Reveal({
  as: Tag = 'div',
  group,
  className = '',
  children,
  id,
}: {
  as?: ElementType
  group?: boolean
  className?: string
  children: ReactNode
  id?: string
}) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (!group || !ref.current) return
    ref.current.querySelectorAll<HTMLElement>('.reveal-item').forEach((el, i) => el.style.setProperty('--i', String(Math.min(i, 8))))
  }, [group])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.setAttribute('data-visible', '')
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag ref={ref} id={id} data-reveal-group={group ? '' : undefined} className={`${group ? '' : 'reveal'} ${className}`}>
      {children}
    </Tag>
  )
}
